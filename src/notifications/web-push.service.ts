import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as webpush from 'web-push';
import { Repository } from 'typeorm';
import { PushSubscription } from './entities/push-subscription.entity';

export type PushPayload = {
  title: string;
  body: string;
  link?: string | null;
  tag?: string;
};

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private configured = false;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushRepo: Repository<PushSubscription>,
  ) {}

  onModuleInit() {
    const publicKey = (process.env.VAPID_PUBLIC_KEY ?? '').trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY ?? '').trim();
    const subject = (process.env.VAPID_SUBJECT ?? '').trim();

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        'Faltan VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY o VAPID_SUBJECT. Web Push deshabilitado.',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  getPublicKey(): string | null {
    const key = (process.env.VAPID_PUBLIC_KEY ?? '').trim();
    return key || null;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async subscribe(
    userId: string,
    endpoint: string,
    keys: { p256dh: string; auth: string },
    userAgent?: string,
  ): Promise<void> {
    const existing = await this.pushRepo.findOne({ where: { endpoint } });
    if (existing) {
      existing.user_id = userId;
      existing.p256dh = keys.p256dh;
      existing.auth = keys.auth;
      existing.user_agent = userAgent?.trim() || existing.user_agent;
      await this.pushRepo.save(existing);
      return;
    }

    await this.pushRepo.save(
      this.pushRepo.create({
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent?.trim() || null,
      }),
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.pushRepo.delete({ user_id: userId, endpoint });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    if (!this.configured) {
      return 0;
    }

    const subs = await this.pushRepo.find({ where: { user_id: userId } });
    if (!subs.length) {
      return 0;
    }

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      link: payload.link ?? '/home',
      tag: payload.tag,
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        sent += 1;
      } catch (error: any) {
        const statusCode = error?.statusCode;
        this.logger.warn(
          `Push falló para ${sub.id}: ${error?.message ?? error}`,
        );
        if (statusCode === 404 || statusCode === 410) {
          await this.pushRepo.delete({ id: sub.id });
        }
      }
    }

    return sent;
  }
}
