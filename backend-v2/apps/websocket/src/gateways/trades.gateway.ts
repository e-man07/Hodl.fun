import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@hodlfun/database';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/trades',
})
export class TradesGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  @SubscribeMessage('subscribe:recent')
  async handleSubscribeRecent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tokenAddress: string },
  ) {
    const room = `trades:${data.tokenAddress.toLowerCase()}`;
    client.join(room);

    // Send recent trades immediately
    const recentTrades = await this.prisma.trade.findMany({
      where: { tokenAddress: data.tokenAddress.toLowerCase() },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    client.emit('recent_trades', { trades: recentTrades });

    return { status: 'subscribed', room };
  }

  @SubscribeMessage('unsubscribe:recent')
  handleUnsubscribeRecent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tokenAddress: string },
  ) {
    const room = `trades:${data.tokenAddress.toLowerCase()}`;
    client.leave(room);
    return { status: 'unsubscribed', room };
  }

  broadcastTrade(tokenAddress: string, trade: unknown) {
    const room = `trades:${tokenAddress.toLowerCase()}`;
    this.server.to(room).emit('new_trade', trade);
  }
}
