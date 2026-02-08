// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/BondingCurve.sol";
import "../../src/BondingCurveFactory.sol";
import "../../src/Core.sol";
import "../../src/Token.sol";
import "../../src/FeeVault.sol";

contract MockWNativeInvariant is ERC20 {
    constructor() ERC20("Wrapped Native", "WNATIVE") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }

    receive() external payable {
        deposit();
    }
}

contract MockUniswapV3FactoryInvariant {
    mapping(bytes32 => address) public pools;
    uint256 public poolCount = 0;

    function getPool(address tokenA, address tokenB, uint24 fee) public view returns (address) {
        return pools[keccak256(abi.encodePacked(tokenA, tokenB, fee))];
    }

    function createPool(address tokenA, address tokenB, uint24 fee) public returns (address) {
        bytes32 key = keccak256(abi.encodePacked(tokenA, tokenB, fee));
        require(pools[key] == address(0), "Pool exists");
        address mockPool = address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB, fee, poolCount++)))));
        pools[key] = mockPool;
        return mockPool;
    }
}

/// @title BondingCurve Handler for Invariant Testing
/// @notice Handles random actions on the bonding curve system
contract BondingCurveHandler is Test {
    MockWNativeInvariant public wNative;
    Core public core;
    address public token;
    address public curve;

    address[] public actors;
    address internal currentActor;

    // Track state for invariant checks
    uint256 public totalBuys;
    uint256 public totalSells;
    uint256 public totalNativeIn;
    uint256 public totalNativeOut;
    uint256 public totalTokensBought;
    uint256 public totalTokensSold;

    modifier useActor(uint256 actorIndexSeed) {
        currentActor = actors[bound(actorIndexSeed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(
        MockWNativeInvariant _wNative,
        Core _core,
        address _token,
        address _curve,
        address[] memory _actors
    ) {
        wNative = _wNative;
        core = _core;
        token = _token;
        curve = _curve;
        actors = _actors;

        // Give all actors some wNative
        for (uint i = 0; i < actors.length; i++) {
            vm.deal(actors[i], 1000 ether);
            vm.prank(actors[i]);
            wNative.deposit{value: 500 ether}();
        }
    }

    function buy(uint256 actorSeed, uint256 amount) external useActor(actorSeed) {
        amount = bound(amount, 0.001 ether, 10 ether);

        uint256 wNativeBal = wNative.balanceOf(currentActor);
        if (wNativeBal < amount) return;

        // Check curve not locked (graduated)
        if (IBondingCurve(curve).getLock()) return;

        wNative.approve(address(core), amount);

        uint256 tokensBefore = IERC20(token).balanceOf(currentActor);

        try core.exactInBuy(amount, 0, token, currentActor, block.timestamp + 1 hours) {
            uint256 tokensAfter = IERC20(token).balanceOf(currentActor);
            totalBuys++;
            totalNativeIn += amount;
            totalTokensBought += (tokensAfter - tokensBefore);
        } catch {
            // Action failed, that's ok for invariant testing
        }
    }

    function sell(uint256 actorSeed, uint256 percentage) external useActor(actorSeed) {
        percentage = bound(percentage, 1, 100);

        uint256 tokenBal = IERC20(token).balanceOf(currentActor);
        if (tokenBal == 0) return;

        // Check curve not locked (graduated)
        if (IBondingCurve(curve).getLock()) return;

        uint256 tokensToSell = (tokenBal * percentage) / 100;
        if (tokensToSell == 0) return;

        IERC20(token).approve(address(core), tokensToSell);

        uint256 wNativeBefore = wNative.balanceOf(currentActor);

        try core.exactInSell(tokensToSell, 0, token, currentActor, currentActor, block.timestamp + 1 hours) {
            uint256 wNativeAfter = wNative.balanceOf(currentActor);
            totalSells++;
            totalTokensSold += tokensToSell;
            totalNativeOut += (wNativeAfter - wNativeBefore);
        } catch {
            // Action failed, that's ok for invariant testing
        }
    }
}

/// @title BondingCurve Invariant Tests
/// @notice Tests system-wide invariants that must always hold
contract BondingCurveInvariantTest is StdInvariant, Test {
    MockWNativeInvariant wNative;
    FeeVault feeVault;
    Core core;
    BondingCurveFactory factory;
    MockUniswapV3FactoryInvariant uniswapFactory;
    BondingCurveHandler handler;

    address admin = address(0x1);
    address creator = address(0x2);
    address[] actors;

    address curve;
    address token;

    // Configuration
    uint256 deployFee = 0.1 ether;
    uint256 listingFee = 1 ether;
    uint256 virtualNative = 10 ether;
    uint256 virtualToken = 1_000_000 * 1e18;
    uint256 graduationMarketCap = 100_000 ether;
    uint8 feeDenominator = 200;
    uint16 feeNumerator = 1;
    uint24 dexFee = 3000;

    // Track initial state
    uint256 initialK;
    uint256 totalTokenSupply;

    function setUp() public {
        // Setup actors
        actors.push(address(0x10));
        actors.push(address(0x11));
        actors.push(address(0x12));
        actors.push(address(0x13));
        actors.push(address(0x14));

        wNative = new MockWNativeInvariant();

        vm.deal(admin, 10000 ether);
        vm.deal(creator, 10000 ether);

        uniswapFactory = new MockUniswapV3FactoryInvariant();

        FeeVault feeVaultImpl = new FeeVault();
        feeVault = FeeVault(address(new ERC1967Proxy(address(feeVaultImpl), "")));

        Core coreImpl = new Core(address(wNative), address(feeVault));
        core = Core(payable(address(new ERC1967Proxy(address(coreImpl), ""))));

        BondingCurveFactory factoryImpl = new BondingCurveFactory(address(wNative));
        factory = BondingCurveFactory(address(new ERC1967Proxy(address(factoryImpl), "")));

        vm.startPrank(admin);
        core.initialize(address(0), admin);
        core.setFactory(address(factory));
        vm.stopPrank();

        feeVault.initialize(
            address(wNative),
            "Fee Vault",
            "fVAULT",
            address(core),
            admin
        );

        vm.prank(admin);
        IBondingCurveFactory.InitializeParams memory params = IBondingCurveFactory.InitializeParams({
            owner: admin,
            core: address(core),
            deployFee: deployFee,
            listingFee: listingFee,
            virtualNative: virtualNative,
            virtualToken: virtualToken,
            graduationMarketCap: graduationMarketCap,
            feeDenominator: feeDenominator,
            feeNumerator: feeNumerator,
            dexFactory: address(uniswapFactory),
            dexFee: dexFee
        });
        factory.initialize(params);

        // Create a token for testing
        vm.startPrank(creator);
        wNative.deposit{value: deployFee}();
        wNative.approve(address(core), deployFee);
        (curve, token) = core.createCurve(
            creator,
            "Invariant Test Token",
            "INVT",
            "ipfs://test",
            0,
            deployFee
        );
        vm.stopPrank();

        // Store initial state
        initialK = IBondingCurve(curve).getK();
        totalTokenSupply = IERC20(token).totalSupply();

        // Create handler
        handler = new BondingCurveHandler(wNative, core, token, curve, actors);

        // Target the handler for invariant testing
        targetContract(address(handler));
    }

    // ============ Invariant: Constant Product k ============

    /// @notice k should never increase significantly (would indicate pricing bug favoring users)
    function invariant_kNeverIncreasesSignificantly() public view {
        if (IBondingCurve(curve).getLock()) return;

        (uint256 vNative, uint256 vToken) = IBondingCurve(curve).getVirtualReserves();
        uint256 currentK = vNative * vToken;

        // k can decrease slightly due to rounding, but should never increase significantly
        // Allow 0.1% increase tolerance for any numerical artifacts
        assertLe(currentK, (initialK * 1001) / 1000, "k should not increase significantly");
    }

    /// @notice k should not decrease more than 1% (excessive rounding loss)
    function invariant_kNeverDecreasesSignificantly() public view {
        if (IBondingCurve(curve).getLock()) return;

        (uint256 vNative, uint256 vToken) = IBondingCurve(curve).getVirtualReserves();
        uint256 currentK = vNative * vToken;

        // k should not decrease more than 1%
        assertGe(currentK, (initialK * 99) / 100, "k should not decrease more than 1%");
    }

    // ============ Invariant: Token Supply ============

    /// @notice Total token supply should never exceed initial minted amount
    function invariant_tokenSupplyNeverExceeds() public view {
        uint256 currentSupply = IERC20(token).totalSupply();
        assertLe(currentSupply, totalTokenSupply, "Token supply should never exceed initial amount");
    }

    // ============ Invariant: Reserves Consistency ============

    /// @notice Virtual reserves should always be >= real reserves
    function invariant_virtualReservesGreaterThanReal() public view {
        if (IBondingCurve(curve).getLock()) return;

        (uint256 vNative, uint256 vToken) = IBondingCurve(curve).getVirtualReserves();
        (uint256 rNative, uint256 rToken) = IBondingCurve(curve).getReserves();

        assertGe(vNative, rNative, "Virtual native should be >= real native");
        // Note: vToken < rToken can happen if tokens are transferred directly to curve
    }

    // ============ Invariant: Price Always Positive ============

    /// @notice Price should always be positive
    function invariant_priceAlwaysPositive() public view {
        if (IBondingCurve(curve).getLock()) return;

        uint256 price = IBondingCurve(curve).getCurrentPrice();
        assertGt(price, 0, "Price should always be positive");
    }

    // ============ Invariant: Market Cap Consistency ============

    /// @notice Market cap should be price * total supply
    function invariant_marketCapConsistency() public view {
        if (IBondingCurve(curve).getLock()) return;

        uint256 price = IBondingCurve(curve).getCurrentPrice();
        uint256 supply = IERC20(token).totalSupply();
        uint256 calculatedMarketCap = (price * supply) / 1e18;
        uint256 reportedMarketCap = IBondingCurve(curve).calculateMarketCap();

        // Allow for small rounding differences
        if (calculatedMarketCap > 0) {
            uint256 diff = calculatedMarketCap > reportedMarketCap
                ? calculatedMarketCap - reportedMarketCap
                : reportedMarketCap - calculatedMarketCap;

            // Allow 1% difference due to rounding
            assertLe(diff * 100 / calculatedMarketCap, 1, "Market cap should be consistent with price * supply");
        }
    }

    // ============ Invariant: ATH Never Decreases ============

    /// @notice ATH (All Time High) price should never decrease
    function invariant_athNeverDecreases() public view {
        (uint256 athPrice,) = IBondingCurve(curve).getATHPrice();
        uint256 currentPrice = IBondingCurve(curve).getCurrentPrice();

        assertGe(athPrice, currentPrice, "ATH should always be >= current price");
    }

    // ============ Invariant: Curve Token Balance Consistency ============

    /// @notice Curve's token balance should be >= real token reserve
    /// @dev Tokens can be transferred directly to curve, so balance >= reserve
    function invariant_curveTokenBalanceConsistency() public view {
        if (IBondingCurve(curve).getLock()) return;

        (, uint256 rToken) = IBondingCurve(curve).getReserves();
        uint256 curveBalance = IERC20(token).balanceOf(curve);

        // Curve balance should be >= tracked reserve (extra tokens could be donated)
        assertGe(curveBalance, rToken, "Curve token balance should be >= real token reserve");
    }

    // ============ Invariant: Curve Native Balance Consistency ============

    /// @notice Curve's wNative balance should equal real native reserve
    function invariant_curveNativeBalanceConsistency() public view {
        if (IBondingCurve(curve).getLock()) return;

        (uint256 rNative,) = IBondingCurve(curve).getReserves();
        uint256 curveBalance = wNative.balanceOf(curve);

        assertEq(curveBalance, rNative, "Curve wNative balance should equal real native reserve");
    }

    // ============ Helper to get summary ============

    function invariant_callSummary() public view {
        console.log("Buy calls:", handler.totalBuys());
        console.log("Sell calls:", handler.totalSells());
        console.log("Total native in:", handler.totalNativeIn());
        console.log("Total native out:", handler.totalNativeOut());
        console.log("Total tokens bought:", handler.totalTokensBought());
        console.log("Total tokens sold:", handler.totalTokensSold());
    }
}
