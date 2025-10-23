import { ethers } from 'ethers';
import { CURRENT_NETWORK } from '@/config/contracts';
import { TOKEN_FACTORY_ABI } from '@/config/abis';

/**
 * Extract token contract address from transaction hash
 * @param txHash Transaction hash from token creation
 * @returns Token contract address or null if not found
 */
export async function getTokenAddressFromTx(txHash: string): Promise<string | null> {
  try {
    // Create provider for Push Chain
    const provider = new ethers.JsonRpcProvider(CURRENT_NETWORK.rpcUrl);
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt || !receipt.logs) {
      console.error('No receipt or logs found for transaction:', txHash);
      return null;
    }
    
    // Parse logs to find TokenCreated event
    const contractInterface = new ethers.Interface(TOKEN_FACTORY_ABI);
    
    for (const log of receipt.logs) {
      try {
        const parsedLog = contractInterface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        
        if (parsedLog && parsedLog.name === 'TokenCreated') {
          const tokenAddress = parsedLog.args[0];
          console.log('🎯 Token address found:', tokenAddress);
          return tokenAddress;
        }
      } catch {
        // Skip logs that don't match our interface
        continue;
      }
    }
    
    console.error('TokenCreated event not found in transaction logs');
    return null;
    
  } catch (error) {
    console.error('Error extracting token address from transaction:', error);
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
