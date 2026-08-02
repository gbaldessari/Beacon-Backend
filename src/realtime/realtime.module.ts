import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule, authJwtOptionsFactory } from 'src/auth/auth.module';
import { FinanceModule } from 'src/finance/finance.module';
import { RemindersModule } from 'src/reminders/reminders.module';
import { RealtimeEventsService } from './realtime-events.service';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: authJwtOptionsFactory,
    }),
    forwardRef(() => RemindersModule),
    forwardRef(() => FinanceModule),
  ],
  providers: [RealtimeGateway, RealtimeEventsService],
  exports: [RealtimeEventsService],
})
export class RealtimeModule {}
