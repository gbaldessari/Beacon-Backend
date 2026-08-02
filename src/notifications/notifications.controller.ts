import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import {
  ListNotificationsQueryDto,
  SubscribePushDto,
  UnsubscribePushDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { WebPushService } from './web-push.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly webPushService: WebPushService,
  ) {}

  @Get('push/vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.webPushService.getPublicKey() };
  }

  @Post('push/subscribe')
  async subscribe(@Request() req, @Body() dto: SubscribePushDto) {
    await this.webPushService.subscribe(
      req.user.userId,
      dto.endpoint,
      dto.keys,
      dto.userAgent,
    );
    return { success: true };
  }

  @Delete('push/subscribe')
  async unsubscribe(@Request() req, @Body() dto: UnsubscribePushDto) {
    await this.webPushService.unsubscribe(req.user.userId, dto.endpoint);
    return { success: true };
  }

  @Get('unread-count')
  async unreadCount(@Request() req) {
    const count = await this.notificationsService.unreadCount(req.user.userId);
    return { count };
  }

  @Patch('read-all')
  async markAllRead(@Request() req) {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Get()
  async list(@Request() req, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.list(
      req.user.userId,
      query.limit,
      query.offset,
    );
  }

  @Patch(':id/read')
  async markRead(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(req.user.userId, id);
  }
}
