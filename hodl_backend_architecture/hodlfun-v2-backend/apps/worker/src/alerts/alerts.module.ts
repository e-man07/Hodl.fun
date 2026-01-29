import { Module } from '@nestjs/common';
import { AlertsProcessor } from './alerts.processor';

@Module({
  providers: [AlertsProcessor],
  exports: [AlertsProcessor],
})
export class AlertsModule {}
