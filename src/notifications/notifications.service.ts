import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EmailService } from 'src/email/email.service';
import { User } from 'src/auth/entities/user.entity';
import { IsNull, Repository } from 'typeorm';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { Notification } from './entities/notification.entity';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
} from './notifications.enums';
import { WebPushService } from './web-push.service';

export type NotificationView = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  payload?: Record<string, unknown> | null;
  dedupeBase: string;
  email?: {
    to?: string;
    whenLabel?: string;
    kind?: 'reminder' | 'invite';
    invite?: {
      resourceKind: 'calendar' | 'finance';
      resourceName: string;
      inviterName: string;
      roleLabel: string;
      acceptUrl: string;
    };
  };
  channels?: NotificationChannel[];
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepo: Repository<Notification>,
    @InjectRepository(NotificationDelivery)
    private readonly deliveriesRepo: Repository<NotificationDelivery>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly emailService: EmailService,
    private readonly webPushService: WebPushService,
  ) {}

  async list(
    userId: string,
    limit = 30,
    offset = 0,
  ): Promise<NotificationView[]> {
    const rows = await this.notificationsRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: Math.min(limit, 100),
      skip: Math.max(offset, 0),
    });
    return rows.map((row) => this.toView(row));
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationsRepo.count({
      where: { user_id: userId, read_at: IsNull() },
    });
  }

  async markRead(userId: string, id: string): Promise<NotificationView> {
    const row = await this.notificationsRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!row) {
      throw new NotFoundException('Notificación no encontrada.');
    }
    if (!row.read_at) {
      row.read_at = new Date();
      await this.notificationsRepo.save(row);
    }
    return this.toView(row);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationsRepo.update(
      { user_id: userId, read_at: IsNull() },
      { read_at: new Date() },
    );
    return { updated: result.affected ?? 0 };
  }

  async createAndDeliver(input: CreateNotificationInput): Promise<void> {
    const channels =
      input.channels ??
      [
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
        NotificationChannel.PUSH,
      ];

    let notificationId: string | null = null;

    if (channels.includes(NotificationChannel.IN_APP)) {
      const inAppKey = `${input.dedupeBase}:in_app`;
      if (await this.claimDelivery(input.userId, NotificationChannel.IN_APP, inAppKey)) {
        try {
          const saved = await this.notificationsRepo.save(
            this.notificationsRepo.create({
              user_id: input.userId,
              type: input.type,
              title: input.title,
              body: input.body,
              link: input.link ?? null,
              payload: input.payload ?? null,
            }),
          );
          notificationId = saved.id;
          await this.markDelivery(
            inAppKey,
            NotificationDeliveryStatus.SENT,
          );
        } catch (error: any) {
          await this.markDelivery(
            inAppKey,
            NotificationDeliveryStatus.FAILED,
            error?.message,
          );
        }
      }
    }

    if (channels.includes(NotificationChannel.EMAIL)) {
      const emailKey = `${input.dedupeBase}:email`;
      if (await this.claimDelivery(input.userId, NotificationChannel.EMAIL, emailKey)) {
        try {
          const user =
            (await this.usersRepo.findOne({ where: { id: input.userId } })) ??
            null;
          const to = input.email?.to ?? user?.email;
          if (!to) {
            await this.markDelivery(
              emailKey,
              NotificationDeliveryStatus.SKIPPED,
              'Sin email',
            );
          } else if (input.email?.kind === 'invite' && input.email.invite) {
            await this.emailService.sendInviteEmail(to, input.email.invite);
            await this.markDelivery(emailKey, NotificationDeliveryStatus.SENT);
          } else {
            const frontend = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
            const link = input.link
              ? `${frontend}${input.link.startsWith('/') ? '' : '/'}${input.link}`
              : frontend || undefined;
            await this.emailService.sendReminderNotificationEmail(to, {
              title: input.title,
              whenLabel: input.email?.whenLabel ?? input.body,
              link,
            });
            await this.markDelivery(emailKey, NotificationDeliveryStatus.SENT);
          }
        } catch (error: any) {
          this.logger.warn(`Email notify falló: ${error?.message ?? error}`);
          await this.markDelivery(
            emailKey,
            NotificationDeliveryStatus.FAILED,
            error?.message,
          );
        }
      }
    }

    if (channels.includes(NotificationChannel.PUSH)) {
      const pushKey = `${input.dedupeBase}:push`;
      if (await this.claimDelivery(input.userId, NotificationChannel.PUSH, pushKey)) {
        try {
          const sent = await this.webPushService.sendToUser(input.userId, {
            title: input.title,
            body: input.body,
            link: input.link,
            tag: notificationId ?? input.dedupeBase,
          });
          await this.markDelivery(
            pushKey,
            sent > 0
              ? NotificationDeliveryStatus.SENT
              : NotificationDeliveryStatus.SKIPPED,
            sent > 0 ? null : 'Sin suscripciones push',
          );
        } catch (error: any) {
          await this.markDelivery(
            pushKey,
            NotificationDeliveryStatus.FAILED,
            error?.message,
          );
        }
      }
    }
  }

  /**
   * Notifica invitación: email siempre al destinatario; in-app/push si ya hay usuario.
   */
  async notifyInvite(params: {
    email: string;
    existingUserId?: string | null;
    type: NotificationType.CALENDAR_INVITE | NotificationType.FINANCE_INVITE;
    title: string;
    body: string;
    link: string;
    invite: {
      resourceKind: 'calendar' | 'finance';
      resourceName: string;
      inviterName: string;
      roleLabel: string;
      acceptUrl: string;
    };
    dedupeBase: string;
  }): Promise<void> {
    if (params.existingUserId) {
      await this.createAndDeliver({
        userId: params.existingUserId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        dedupeBase: params.dedupeBase,
        email: {
          to: params.email,
          kind: 'invite',
          invite: params.invite,
        },
        channels: [
          NotificationChannel.IN_APP,
          NotificationChannel.EMAIL,
          NotificationChannel.PUSH,
        ],
      });
      return;
    }

    try {
      await this.emailService.sendInviteEmail(params.email, params.invite);
    } catch (error: any) {
      this.logger.warn(`Invite email falló: ${error?.message ?? error}`);
    }
  }

  private async claimDelivery(
    userId: string,
    channel: NotificationChannel,
    dedupeKey: string,
  ): Promise<boolean> {
    try {
      await this.deliveriesRepo.insert({
        user_id: userId,
        channel,
        dedupe_key: dedupeKey,
        status: NotificationDeliveryStatus.SKIPPED,
        error: null,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async markDelivery(
    dedupeKey: string,
    status: NotificationDeliveryStatus,
    error?: string | null,
  ): Promise<void> {
    await this.deliveriesRepo.update(
      { dedupe_key: dedupeKey },
      { status, error: error?.slice(0, 1000) ?? null },
    );
  }

  private toView(row: Notification): NotificationView {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      payload: row.payload,
      readAt: row.read_at ? row.read_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    };
  }
}
