// Debug utility to help troubleshoot contract issues

interface TokenParams {
  name?: string;
  symbol?: string;
  totalSupply?: string | number | bigint;
  reserveRatio?: number;
  creator?: string;
  metadataURI?: string;
}

export const debugTokenParams = (params: TokenParams) => {
  console.log('🔍 DEBUGGING TOKEN PARAMETERS:');
  
  // Check name
  const nameLength = params.name?.length || 0;
  console.log(`📝 Name: "${params.name}" (length: ${nameLength})`);
  console.log(`   ✅ Valid length (3-50): ${nameLength >= 3 && nameLength <= 50}`);
  
  // Check symbol  
  const symbolLength = params.symbol?.length || 0;
  console.log(`🏷️  Symbol: "${params.symbol}" (length: ${symbolLength})`);
  console.log(`   ✅ Valid length (2-10): ${symbolLength >= 2 && symbolLength <= 10}`);
  
  // Check total supply
  let totalSupply: bigint;
  if (typeof params.totalSupply === 'bigint') {
    totalSupply = params.totalSupply;
  } else {
    totalSupply = BigInt(params.totalSupply || 0);
  }
  const minSupply = BigInt('1000000000000000000000000'); // 1M * 10^18
  const maxSupply = BigInt('100000000000000000000000000'); // 100M * 10^18
  console.log(`💰 Total Supply: ${totalSupply.toString()}`);
  console.log(`   ✅ Valid range (1M-100M): ${totalSupply >= minSupply && totalSupply <= maxSupply}`);
  
  // Check reserve ratio
  const reserveRatio = Number(params.reserveRatio || 0);
  console.log(`📊 Reserve Ratio: ${reserveRatio}`);
  console.log(`   ✅ Valid range (1000-9000): ${reserveRatio >= 1000 && reserveRatio <= 9000}`);
  
  // Check creator
  console.log(`👤 Creator: ${params.creator}`);
  console.log(`   ✅ Valid address: ${params.creator !== '0x0000000000000000000000000000000000000000'}`);
  
  // Check metadata URI
  console.log(`🔗 Metadata URI: ${params.metadataURI}`);
  console.log(`   ✅ Not empty: ${!!params.metadataURI}`);
  
  return {
    nameValid: nameLength >= 3 && nameLength <= 50,
    symbolValid: symbolLength >= 2 && symbolLength <= 10,
    supplyValid: totalSupply >= minSupply && totalSupply <= maxSupply,
    ratioValid: reserveRatio >= 1000 && reserveRatio <= 9000,
    creatorValid: params.creator !== '0x0000000000000000000000000000000000000000',
    metadataValid: !!params.metadataURI
  };
};

export const commonIssues = {
  INSUFFICIENT_FEE: 'Creation fee (0.01 ETH) not paid',
  INVALID_NAME: 'Token name must be 3-50 characters',
  INVALID_SYMBOL: 'Token symbol must be 2-10 characters', 
  INVALID_SUPPLY: 'Total supply must be 1M-100M tokens',
  INVALID_RATIO: 'Reserve ratio must be 1000-9000 (10%-90%)',
  INVALID_CREATOR: 'Creator address cannot be zero',
  MARKETPLACE_ERROR: 'Error listing token on marketplace',
  INSUFFICIENT_GAS: 'Transaction ran out of gas'
};

interface ValidationResult {
  nameValid: boolean;
  symbolValid: boolean;
  supplyValid: boolean;
  ratioValid: boolean;
  creatorValid: boolean;
  metadataValid: boolean;
}

export const suggestFix = (validation: ValidationResult) => {
  const issues = [];
  
  if (!validation.nameValid) issues.push(commonIssues.INVALID_NAME);
  if (!validation.symbolValid) issues.push(commonIssues.INVALID_SYMBOL);
  if (!validation.supplyValid) issues.push(commonIssues.INVALID_SUPPLY);
  if (!validation.ratioValid) issues.push(commonIssues.INVALID_RATIO);
  if (!validation.creatorValid) issues.push(commonIssues.INVALID_CREATOR);
  if (!validation.metadataValid) issues.push('Metadata URI is empty');
  
  if (issues.length === 0) {
    return 'Parameters look valid. Issue might be with marketplace listing or gas.';
  }
  
  return `Found issues: ${issues.join(', ')}`;
};
