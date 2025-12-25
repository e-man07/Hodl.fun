// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ICore
 * @notice Interface for core orchestrator contract
 */
interface ICore {
    /// @notice Emitted when a curve is created
    event CreateCurve(
        address indexed creator,
        address indexed curve,
        address indexed token,
        string tokenURI,
        string name,
        string symbol
    );

    /// @notice Emitted when tokens are bought
    event Buy(
        address indexed token,
        address indexed to,
        uint256 amountIn,
        uint256 amountOut,
        uint256 price,
        uint256 timestamp
    );

    /// @notice Emitted when tokens are sold
    event Sell(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amountIn,
        uint256 amountOut,
        uint256 price,
        uint256 timestamp
    );

    /**
     * @notice Create a new curve with initial liquidity
     * @param creator Creator address
     * @param name Token name
     * @param symbol Token symbol
     * @param tokenURI Token metadata URI
     * @param amountIn Initial liquidity amount
     * @param fee Fee amount
     * @return curve Bonding curve address
     * @return token Token address
     */
    function createCurve(
        address creator,
        string memory name,
        string memory symbol,
        string memory tokenURI,
        uint256 amountIn,
        uint256 fee
    ) external payable returns (address curve, address token);

    /**
     * @notice Buy tokens with exact input
     * @param amountIn Amount of native to spend
     * @param amountOutMin Minimum tokens expected
     * @param token Token address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactInBuy(
        uint256 amountIn,
        uint256 amountOutMin,
        address token,
        address to,
        uint256 deadline
    ) external payable;

    /**
     * @notice Buy tokens with exact output
     * @param amountOut Amount of tokens wanted
     * @param amountInMax Maximum native to spend
     * @param token Token address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactOutBuy(
        uint256 amountOut,
        uint256 amountInMax,
        address token,
        address to,
        uint256 deadline
    ) external payable;

    /**
     * @notice Sell tokens with exact input
     * @param amountIn Amount of tokens to sell
     * @param amountOutMin Minimum native expected
     * @param token Token address
     * @param from Seller address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactInSell(
        uint256 amountIn,
        uint256 amountOutMin,
        address token,
        address from,
        address to,
        uint256 deadline
    ) external;

    /**
     * @notice Sell tokens with exact output
     * @param amountOut Amount of native wanted
     * @param amountInMax Maximum tokens to sell
     * @param token Token address
     * @param from Seller address
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function exactOutSell(
        uint256 amountOut,
        uint256 amountInMax,
        address token,
        address from,
        address to,
        uint256 deadline
    ) external;

    /**
     * @notice Get curve data
     * @param curve Bonding curve address
     * @return virtualNative Virtual native reserve
     * @return virtualToken Virtual token reserve
     * @return k Constant product value
     */
    function getCurveData(address curve) external view returns (uint256 virtualNative, uint256 virtualToken, uint256 k);

    /**
     * @notice Get amount out for given input
     * @param amountIn Input amount
     * @param k Constant product
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountOut Output amount
     */
    function getAmountOut(uint256 amountIn, uint256 k, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256 amountOut);

    /**
     * @notice Get amount in for given output
     * @param amountOut Output amount
     * @param k Constant product
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     * @return amountIn Input amount
     */
    function getAmountIn(uint256 amountOut, uint256 k, uint256 reserveIn, uint256 reserveOut) external pure returns (uint256 amountIn);

    /**
     * @notice Get fee vault address
     * @return vault Fee vault address
     */
    function getFeeVault() external view returns (address vault);

    /**
     * @notice Get current price for a token
     * @param token Token address
     * @return price Current price per token in native currency (scaled by 1e18)
     */
    function getCurrentPrice(address token) external view returns (uint256 price);

    /**
     * @notice Calculate market cap for a token
     * @param token Token address
     * @return marketCap Market cap in native currency (ETH/PUSH)
     */
    function calculateMarketCap(address token) external view returns (uint256 marketCap);
}

