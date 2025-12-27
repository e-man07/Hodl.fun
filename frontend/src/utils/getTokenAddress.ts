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
    const provider = new ethers.JsonRpcProvider(CURRENT_NETWORK.rpcUrl);
    
    let receipt: ethers.TransactionReceipt | null = null;
    const startTime = Date.now();
    const pollInterval = 2000;
    
    while (!receipt && (Date.now() - startTime) < maxWaitTime) {
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        break;
        
      } catch {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }
    }
    
    if (!receipt) {
      return null;
    }
    
    if (!receipt.logs || receipt.logs.length === 0) {
      return null;
    }
    
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
          let tokenAddress = parsedLog.args[0];
          
          if (typeof parsedLog.args === 'object' && parsedLog.args !== null && !Array.isArray(parsedLog.args)) {
            const argsObj = parsedLog.args as Record<string, unknown>;
            tokenAddress = (argsObj.tokenAddress as string | undefined) || (argsObj[0] as string | undefined) || tokenAddress;
          }
          
          if (!tokenAddress) {
            continue;
          }
          
          const addressString = typeof tokenAddress === 'string' 
            ? tokenAddress 
            : typeof tokenAddress === 'object' && 'toString' in tokenAddress
            ? tokenAddress.toString()
            : String(tokenAddress);
          
          return addressString;
        }
      } catch {
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
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
