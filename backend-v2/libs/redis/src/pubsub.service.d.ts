import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
type MessageHandler = (message: unknown) => void;
export declare class PubSubService implements OnModuleDestroy {
    private configService;
    private readonly logger;
    private readonly publisher;
    private readonly subscriber;
    private readonly handlers;
    constructor(configService: ConfigService);
    publish(channel: string, message: unknown): Promise<void>;
    subscribe(channel: string, handler: MessageHandler): Promise<void>;
    unsubscribe(channel: string): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
export {};
