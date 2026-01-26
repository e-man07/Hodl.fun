import { Module } from '@nestjs/common';
import { RpcService } from './rpc.service';

@Module({
  providers: [RpcService],
  exports: [RpcService],
})
export class BlockchainModule {}
