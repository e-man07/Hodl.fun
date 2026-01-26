// Contract ABIs for event parsing

export const CORE_ABI = [
  'event CreateCurve(address indexed creator, address indexed curve, address indexed token, string tokenURI, string name, string symbol)',
  'event Buy(address indexed token, address indexed to, uint256 amountIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sell(address indexed token, address indexed from, address indexed to, uint256 amountIn, uint256 amountOut, uint256 price, uint256 timestamp)',
];

export const BONDING_CURVE_ABI = [
  'event Buy(address indexed to, address indexed token, uint256 amountNativeIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sell(address indexed to, address indexed token, uint256 amountTokenIn, uint256 amountOut, uint256 price, uint256 timestamp)',
  'event Sync(address indexed token, uint256 realNative, uint256 realToken, uint256 virtualNative, uint256 virtualToken, uint256 price, uint256 timestamp)',
  'event Lock(address indexed token)',
  'event Listing(address indexed curve, address indexed token, address indexed pool, uint256 amount0, uint256 amount1, uint128 liquidity)',
  'event NewATHPrice(address indexed token, uint256 newPrice, uint256 timestamp)',
  'event NewATHMarketCap(address indexed token, uint256 newMarketCap, uint256 timestamp)',
];

export const FACTORY_ABI = [
  'event Create(address indexed creator, address indexed curve, address indexed token, string tokenURI, string name, string symbol, uint256 virtualNative, uint256 virtualToken)',
  'event CreatorFeesAccumulated(address indexed creator, uint256 amount, uint256 totalAccumulated)',
  'event CreatorFeesClaimed(address indexed creator, uint256 amount)',
];
