// Contract ABIs for frontend integration - REAL ABIs from compiled contracts
export const TOKEN_FACTORY_ABI = [
  // Token Creation
  {
    "type": "function",
    "name": "createToken",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ITokenFactory.TokenParams",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "symbol",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "totalSupply",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "metadataURI",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "reserveRatio",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "creator",
            "type": "address",
            "internalType": "address"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "tokenAddress",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "payable"
  },
  // Creation Fee
  {
    "type": "function",
    "name": "creationFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  // Marketplace getter
  {
    "type": "function",
    "name": "marketplace",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  // View Functions
  {
    "type": "function",
    "name": "getTokensByCreator",
    "inputs": [{"name": "creator", "type": "address"}],
    "outputs": [{"name": "tokens", "type": "address[]"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getTotalTokensCreated",
    "inputs": [],
    "outputs": [{"name": "count", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isValidToken",
    "inputs": [{"name": "tokenAddress", "type": "address"}],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "creationFee",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  // Events
  {
    "type": "event",
    "name": "TokenCreated",
    "inputs": [
      {"name": "tokenAddress", "type": "address", "indexed": true},
      {"name": "creator", "type": "address", "indexed": true},
      {"name": "name", "type": "string", "indexed": false},
      {"name": "symbol", "type": "string", "indexed": false},
      {"name": "totalSupply", "type": "uint256", "indexed": false},
      {"name": "metadataURI", "type": "string", "indexed": false}
    ]
  }
] as const;

export const TOKEN_MARKETPLACE_ABI = [
  // Trading Functions
  {
    "type": "function",
    "name": "buyTokens",
    "inputs": [
      {"name": "tokenAddress", "type": "address"},
      {"name": "minTokensOut", "type": "uint256"}
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "sellTokens",
    "inputs": [
      {"name": "tokenAddress", "type": "address"},
      {"name": "tokenAmount", "type": "uint256"},
      {"name": "minEthOut", "type": "uint256"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // Price Calculation Functions
  {
    "type": "function",
    "name": "calculatePurchaseReturn",
    "inputs": [
      {"name": "tokenAddress", "type": "address"},
      {"name": "ethAmount", "type": "uint256"}
    ],
    "outputs": [{"name": "tokenAmount", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "calculateSaleReturn",
    "inputs": [
      {"name": "tokenAddress", "type": "address"},
      {"name": "tokenAmount", "type": "uint256"}
    ],
    "outputs": [{"name": "ethAmount", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCurrentPrice",
    "inputs": [{"name": "tokenAddress", "type": "address"}],
    "outputs": [{"name": "price", "type": "uint256"}],
    "stateMutability": "view"
  },
  // Token Info Functions
  {
    "type": "function",
    "name": "getTokenInfo",
    "inputs": [{"name": "tokenAddress", "type": "address"}],
    "outputs": [
      {
        "name": "tokenInfo",
        "type": "tuple",
        "components": [
          {"name": "tokenAddress", "type": "address"},
          {"name": "creator", "type": "address"},
          {"name": "metadataURI", "type": "string"},
          {"name": "totalSupply", "type": "uint256"},
          {"name": "currentSupply", "type": "uint256"},
          {"name": "reserveBalance", "type": "uint256"},
          {"name": "reserveRatio", "type": "uint256"},
          {"name": "tradingEnabled", "type": "bool"},
          {"name": "launchTimestamp", "type": "uint256"},
          {"name": "marketCap", "type": "uint256"}
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getAllTokens",
    "inputs": [],
    "outputs": [{"name": "tokens", "type": "address[]"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isLiquidityThresholdReached",
    "inputs": [{"name": "tokenAddress", "type": "address"}],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view"
  },
  // Constants
  {
    "type": "function",
    "name": "LIQUIDITY_THRESHOLD",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  // Events
  {
    "type": "event",
    "name": "TokensBought",
    "inputs": [
      {"name": "tokenAddress", "type": "address", "indexed": true},
      {"name": "buyer", "type": "address", "indexed": true},
      {"name": "ethAmount", "type": "uint256", "indexed": false},
      {"name": "tokenAmount", "type": "uint256", "indexed": false},
      {"name": "price", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "TokensSold",
    "inputs": [
      {"name": "tokenAddress", "type": "address", "indexed": true},
      {"name": "seller", "type": "address", "indexed": true},
      {"name": "tokenAmount", "type": "uint256", "indexed": false},
      {"name": "ethAmount", "type": "uint256", "indexed": false},
      {"name": "price", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "TradingEnabled",
    "inputs": [
      {"name": "tokenAddress", "type": "address", "indexed": true},
      {"name": "timestamp", "type": "uint256", "indexed": false}
    ]
  }
] as const;

export const LAUNCHPAD_TOKEN_ABI = [
  // Standard ERC20 functions
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint8"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{"name": "account", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {"name": "owner", "type": "address"},
      {"name": "spender", "type": "address"}
    ],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  // Launchpad specific functions
  {
    "type": "function",
    "name": "metadataURI",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "creator",
    "inputs": [],
    "outputs": [{"name": "", "type": "address"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "tradingEnabled",
    "inputs": [],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "launchTimestamp",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  // ERC20 Transfer event
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {"name": "from", "type": "address", "indexed": true},
      {"name": "to", "type": "address", "indexed": true},
      {"name": "value", "type": "uint256", "indexed": false}
    ]
  }
] as const;

// Standard ERC20 ABI (minimal version for token info)
export const ERC20_ABI = [
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint8"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [{"name": "account", "type": "address"}],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  }
] as const;
