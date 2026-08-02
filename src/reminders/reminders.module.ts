import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { RealtimeModule } from 'src/realtime/realtime.module';
import { CalendarsController } from './calendars.controller';
import { CalendarsService } from './calendars.service';
import { CalendarInvite } from './entities/calendar-invite.entity';
import { CalendarMember } from './entities/calendar-member.entity';
import { Calendar } from './entities/calendar.entity';
import { ReminderCompletion } from './entities/reminder-completion.entity';
import { ReminderException } from './entities/reminder-exception.entity';
import { Reminder } from './entities/reminder.entity';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reminder,
      ReminderCompletion,
      ReminderException,
      Calendar,
      CalendarMember,
      CalendarInvite,
      User,
    ]),
    forwardRef(() => NotificationsModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [RemindersController, CalendarsController],
  providers: [RemindersService, CalendarsService],
  exports: [RemindersService, CalendarsService],
})
export class RemindersModule {}
