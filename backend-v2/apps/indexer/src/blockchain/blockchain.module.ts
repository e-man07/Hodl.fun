import { Module } from '@nestjs/common';
import { RpcService } from './rpc.service';
import { WebSocketService } from './websocket.service';

@Module({
  providers: [RpcService, WebSocketService],
  exports: [RpcService, WebSocketService],
})
export class BlockchainModule {}
