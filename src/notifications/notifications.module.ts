import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { EmailModule } from 'src/email/email.module';
import { RemindersModule } from 'src/reminders/reminders.module';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { Notification } from './entities/notification.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderNotifyJob } from './reminder-notify.job';
import { WebPushService } from './web-push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      PushSubscription,
      NotificationDelivery,
      User,
    ]),
    EmailModule,
    forwardRef(() => RemindersModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, WebPushService, ReminderNotifyJob],
  exports: [NotificationsService, WebPushService],
})
export class NotificationsModule {}
