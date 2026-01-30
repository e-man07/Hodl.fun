import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

@Injectable()
export class WebSocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebSocketService.name);
  private wsProvider: ethers.WebSocketProvider | null = null;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.status === 'connecting' || this.status === 'connected') {
      return;
    }

    this.status = 'connecting';
    const wsUrl = this.configService.get<string>('WS_RPC_URL');

    if (!wsUrl) {
      this.logger.warn('WS_RPC_URL not configured, WebSocket indexing disabled');
      this.status = 'disconnected';
      return;
    }

    try {
      this.logger.log(`Connecting to WebSocket: ${wsUrl}`);
      this.wsProvider = new ethers.WebSocketProvider(wsUrl);

      // Wait for connection
      await this.wsProvider.ready;

      const blockNumber = await this.wsProvider.getBlockNumber();
      this.logger.log(`WebSocket connected! Current block: ${blockNumber}`);

      this.status = 'connected';
      this.reconnectAttempts = 0;

      // Set up connection monitoring
      this.setupConnectionMonitoring();
    } catch (error) {
      this.logger.error(`WebSocket connection failed: ${(error as Error).message}`);
      this.status = 'error';
      this.scheduleReconnect();
    }
  }

  private setupConnectionMonitoring() {
    if (!this.wsProvider) return;

    // Monitor for disconnection
    this.wsProvider.on('error', (error: Error) => {
      this.logger.error(`WebSocket error: ${error.message}`);
      this.handleDisconnect();
    });

    // The WebSocket provider doesn't have a direct 'close' event,
    // but we can detect disconnection when operations fail
  }

  private handleDisconnect() {
    if (this.status === 'disconnected' || this.status === 'connecting') {
      return;
    }

    this.logger.warn('WebSocket disconnected');
    this.status = 'disconnected';
    this.wsProvider = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. WebSocket disabled.`);
      this.status = 'error';
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);

    this.logger.log(`Scheduling WebSocket reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.wsProvider) {
      try {
        await this.wsProvider.destroy();
      } catch (error) {
        this.logger.warn(`Error destroying WebSocket: ${(error as Error).message}`);
      }
      this.wsProvider = null;
    }

    this.status = 'disconnected';
    this.logger.log('WebSocket disconnected');
  }

  getProvider(): ethers.WebSocketProvider | null {
    return this.wsProvider;
  }

  getStatus(): WebSocketStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected' && this.wsProvider !== null;
  }

  async getBlockNumber(): Promise<number | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      return await this.wsProvider!.getBlockNumber();
    } catch (error) {
      this.logger.error(`Failed to get block number via WebSocket: ${(error as Error).message}`);
      this.handleDisconnect();
      return null;
    }
  }

  /**
   * Subscribe to new blocks
   */
  onBlock(callback: (blockNumber: number) => void): () => void {
    if (!this.isConnected()) {
      this.logger.warn('Cannot subscribe to blocks: WebSocket not connected');
      return () => {};
    }

    this.wsProvider!.on('block', callback);

    // Return unsubscribe function
    return () => {
      if (this.wsProvider) {
        this.wsProvider.off('block', callback);
      }
    };
  }

  /**
   * Create a contract instance for event listening
   */
  getContract(address: string, abi: ethers.InterfaceAbi): ethers.Contract | null {
    if (!this.isConnected()) {
      return null;
    }

    return new ethers.Contract(address, abi, this.wsProvider!);
  }
}
