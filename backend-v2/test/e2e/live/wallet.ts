/**
 * Live E2E Test Wallet Setup
 * Manages wallet connection and signing for live blockchain tests
 */
import { ethers, Wallet, JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { NETWORK_CONFIG, TEST_WALLET, testLog } from './config';

let provider: JsonRpcProvider | null = null;
let wallet: Wallet | null = null;

/**
 * Initialize the provider connection
 */
export function getProvider(): JsonRpcProvider {
  if (!provider) {
    provider = new JsonRpcProvider(NETWORK_CONFIG.rpcUrl, {
      chainId: NETWORK_CONFIG.chainId,
      name: 'push-testnet',
    });
    testLog('Provider initialized', { rpcUrl: NETWORK_CONFIG.rpcUrl });
  }
  return provider;
}

/**
 * Initialize the test wallet
 * @throws Error if private key is not configured
 */
export function getWallet(): Wallet {
  if (!wallet) {
    if (!TEST_WALLET.privateKey) {
      throw new Error(
        'TEST_WALLET_PRIVATE_KEY environment variable is required. ' +
          'Set it in your environment or .env.test file.',
      );
    }

    const rpcProvider = getProvider();
    wallet = new Wallet(TEST_WALLET.privateKey, rpcProvider);

    // Verify the wallet address matches expected
    const walletAddress = wallet.address.toLowerCase();
    const expectedAddress = TEST_WALLET.address.toLowerCase();
    if (walletAddress !== expectedAddress) {
      console.warn(
        `Warning: Wallet address ${walletAddress} does not match expected ${expectedAddress}`,
      );
    }

    testLog('Wallet initialized', { address: wallet.address });
  }
  return wallet;
}

/**
 * Get the wallet address
 */
export function getWalletAddress(): string {
  return getWallet().address;
}

/**
 * Get the wallet balance in PUSH
 */
export async function getWalletBalance(): Promise<{
  wei: bigint;
  formatted: string;
}> {
  const rpcProvider = getProvider();
  const walletInstance = getWallet();
  const balance = await rpcProvider.getBalance(walletInstance.address);

  return {
    wei: balance,
    formatted: formatEther(balance),
  };
}

/**
 * Check if wallet has sufficient balance for a transaction
 */
export async function hasSufficientBalance(amountPush: string): Promise<boolean> {
  const balance = await getWalletBalance();
  const requiredWei = parseEther(amountPush);
  return balance.wei >= requiredWei;
}

/**
 * Sign a message with the test wallet (for authentication)
 */
export async function signMessage(message: string): Promise<string> {
  const walletInstance = getWallet();
  return walletInstance.signMessage(message);
}

/**
 * Verify a signed message (local verification)
 */
export function verifyLocalSignature(message: string, signature: string): string {
  return ethers.verifyMessage(message, signature);
}

/**
 * Get current nonce for the wallet
 */
export async function getWalletNonce(): Promise<number> {
  const rpcProvider = getProvider();
  const walletInstance = getWallet();
  return rpcProvider.getTransactionCount(walletInstance.address);
}

/**
 * Get current gas price
 */
export async function getGasPrice(): Promise<bigint> {
  const rpcProvider = getProvider();
  const feeData = await rpcProvider.getFeeData();
  return feeData.gasPrice || 0n;
}

/**
 * Wait for a transaction to be confirmed
 */
export async function waitForTransaction(
  txHash: string,
  confirmations = 1,
): Promise<ethers.TransactionReceipt | null> {
  const rpcProvider = getProvider();
  testLog(`Waiting for transaction ${txHash} with ${confirmations} confirmations...`);

  const receipt = await rpcProvider.waitForTransaction(txHash, confirmations);

  if (receipt) {
    testLog('Transaction confirmed', {
      txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
    });
  }

  return receipt;
}

/**
 * Get the current block number
 */
export async function getCurrentBlockNumber(): Promise<number> {
  const rpcProvider = getProvider();
  return rpcProvider.getBlockNumber();
}

/**
 * Get block by number
 */
export async function getBlock(blockNumber: number): Promise<ethers.Block | null> {
  const rpcProvider = getProvider();
  return rpcProvider.getBlock(blockNumber);
}

/**
 * Print wallet info for debugging
 */
export async function printWalletInfo(): Promise<void> {
  const walletInstance = getWallet();
  const balance = await getWalletBalance();
  const nonce = await getWalletNonce();
  const blockNumber = await getCurrentBlockNumber();

  console.log('=== Wallet Info ===');
  console.log(`Address: ${walletInstance.address}`);
  console.log(`Balance: ${balance.formatted} PUSH`);
  console.log(`Nonce: ${nonce}`);
  console.log(`Current Block: ${blockNumber}`);
  console.log(`Network: Push Chain Testnet (${NETWORK_CONFIG.chainId})`);
  console.log('==================');
}

/**
 * Cleanup provider and wallet instances
 */
export function cleanup(): void {
  if (provider) {
    provider.destroy();
    provider = null;
  }
  wallet = null;
  testLog('Wallet and provider cleanup complete');
}

/**
 * Calculate deadline for transactions
 */
export function getDeadline(secondsFromNow: number): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

/**
 * Export ethers utilities for convenience
 */
export { ethers, parseEther, formatEther };
