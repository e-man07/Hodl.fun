import { ethers } from 'ethers';
import { CURRENT_NETWORK, CONTRACT_ADDRESSES } from '@/config/contracts';
import { TOKEN_FACTORY_ABI } from '@/config/abis';

/**
 * Extract token contract address from transaction hash
 * Waits for transaction confirmation before extracting the address
 * @param txHash Transaction hash from token creation
 * @param maxWaitTime Maximum time to wait for confirmation (in milliseconds, default: 60 seconds)
 * @returns Token contract address or null if not found
 */
export async function getTokenAddressFromTx(
  txHash: string,
  maxWaitTime: number = 60000
): Promise<string | null> {
  try {
    // Create provider for Push Chain
    const provider = new ethers.JsonRpcProvider(CURRENT_NETWORK.rpcUrl);
    
    console.log('⏳ Waiting for transaction confirmation...', txHash);
    
    // Wait for transaction to be mined (with retry logic)
    let receipt: ethers.TransactionReceipt | null = null;
    const startTime = Date.now();
    const pollInterval = 2000; // Poll every 2 seconds
    
    while (!receipt && (Date.now() - startTime) < maxWaitTime) {
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
          // Transaction not mined yet, wait and retry
          console.log('⏳ Transaction not yet confirmed, waiting...');
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        // Transaction is mined, break out of loop
        console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);
        break;
        
      } catch {
        // Error fetching receipt, might still be pending
        console.log('⏳ Waiting for transaction confirmation...');
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
    }
    
    if (!receipt) {
      console.error('⏱️ Timeout: Transaction receipt not found after', maxWaitTime / 1000, 'seconds');
      return null;
    }
    
    if (!receipt.logs || receipt.logs.length === 0) {
      console.error('⚠️ No logs found in transaction receipt');
      return null;
    }
    
    console.log(`📋 Found ${receipt.logs.length} logs in transaction, parsing...`);
    
    // Parse logs to find TokenCreated event
    const contractInterface = new ethers.Interface(TOKEN_FACTORY_ABI);
    const tokenFactoryAddress = CONTRACT_ADDRESSES.TokenFactory;
    
    for (const log of receipt.logs) {
      try {
        // Only check logs from the TokenFactory contract
        if (log.address.toLowerCase() !== tokenFactoryAddress.toLowerCase()) {
          continue;
        }
        
        const parsedLog = contractInterface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        
        if (parsedLog && parsedLog.name === 'TokenCreated') {
          // TokenCreated event: TokenCreated(address indexed tokenAddress, address indexed creator, ...)
          // In ethers v6, indexed parameters can be accessed by name or index
          let tokenAddress = parsedLog.args[0];
          
          // If it's an object with named properties, use the property name
          if (typeof parsedLog.args === 'object' && parsedLog.args !== null && !Array.isArray(parsedLog.args)) {
            const argsObj = parsedLog.args as Record<string, unknown>;
            tokenAddress = (argsObj.tokenAddress as string | undefined) || (argsObj[0] as string | undefined) || tokenAddress;
          }
          
          // Ensure we have a valid address
          if (!tokenAddress) {
            console.error('⚠️ Token address not found in event args:', parsedLog.args);
            continue;
          }
          
          const addressString = typeof tokenAddress === 'string' 
            ? tokenAddress 
            : typeof tokenAddress === 'object' && 'toString' in tokenAddress
            ? tokenAddress.toString()
            : String(tokenAddress);
          
          console.log('🎯 Token address extracted from event:', addressString);
          return addressString;
        }
      } catch {
        // Skip logs that don't match our interface
        continue;
      }
    }
    
    console.error('⚠️ TokenCreated event not found in transaction logs');
    console.log('📋 Log addresses:', receipt.logs.map(log => log.address));
    return null;
    
  } catch (error) {
    console.error('❌ Error extracting token address from transaction:', error);
    return null;
  }
}

/**
 * Get block explorer URL for transaction
 * @param txHash Transaction hash
 * @returns Block explorer URL
 */
export function getTransactionUrl(txHash: string): string {
  return `${CURRENT_NETWORK.blockExplorer}/tx/${txHash}`;
}

/**
 * Get block explorer URL for token contract
 * @param tokenAddress Token contract address
 * @returns Block explorer URL
 */
export function getTokenUrl(tokenAddress: string): string {
  return `${CURRENT_NETWORK.blockExplorer}/address/${tokenAddress}`;
}
