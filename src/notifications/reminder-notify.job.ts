import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RemindersService } from 'src/reminders/reminders.service';
import { NotificationType } from './notifications.enums';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderNotifyJob {
  private readonly logger = new Logger(ReminderNotifyJob.name);
  private running = false;

  constructor(
    private readonly remindersService: RemindersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const targets =
        await this.remindersService.listDueNotificationTargets(new Date());
      for (const target of targets) {
        const whenLabel = `Programado: ${target.occurrenceAt.toLocaleString('es-CL')}`;
        try {
          await this.notificationsService.createAndDeliver({
            userId: target.userId,
            type: NotificationType.REMINDER,
            title: target.title,
            body: target.description?.trim() || whenLabel,
            link: '/home/tasks',
            payload: {
              reminderId: target.reminderId,
              occurrenceAt: target.occurrenceKey,
            },
            dedupeBase: `reminder:${target.reminderId}:${target.occurrenceKey}:${target.userId}`,
            email: { whenLabel, kind: 'reminder' },
          });
        } catch (error: any) {
          this.logger.warn(
            `Fallo entregando aviso ${target.reminderId}: ${error?.message ?? error}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Cron de avisos falló: ${error?.message ?? error}`,
        error?.stack,
      );
    } finally {
      this.running = false;
    }
  }
}
