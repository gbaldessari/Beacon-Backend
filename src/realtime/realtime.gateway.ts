import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { JwtPayload } from 'src/auth/strategie/jwt.strategy';
import { getRequiredJwtSecret } from 'src/auth/utils/jwt-secret.util';
import { CalendarMemberRole } from 'src/reminders/calendar.enums';
import { CalendarsService } from 'src/reminders/calendars.service';
import { FinanceMemberRole } from 'src/finance/finance.enums';
import { SpacesService } from 'src/finance/spaces.service';
import { RealtimeEventsService } from './realtime-events.service';
import { calendarRoom, financeRoom, userRoom } from './realtime.events';

type SocketUser = {
  userId: string;
  email: string;
  sessionId: string;
};

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly calendarsService: CalendarsService,
    private readonly spacesService: SpacesService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeEvents.setServer(server);
    this.logger.log('Realtime gateway ready (namespace /realtime)');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticate(client);
      client.data.user = user;
      await client.join(userRoom(user.userId));
      this.logger.debug(`WS connected user=${user.userId}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unauthorized';
      this.logger.debug(`WS rejected: ${message}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data.user as SocketUser | undefined;
    if (user) {
      this.logger.debug(`WS disconnected user=${user.userId}`);
    }
  }

  @SubscribeMessage('calendar:join')
  async joinCalendar(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { calendarId?: string },
  ): Promise<{ ok: boolean; room?: string; error?: string }> {
    const user = this.requireUser(client);
    const calendarId = body?.calendarId?.trim();
    if (!calendarId) {
      return { ok: false, error: 'calendarId required' };
    }

    try {
      await this.calendarsService.assertMembership(
        user.userId,
        calendarId,
        CalendarMemberRole.VIEWER,
      );
      const room = calendarRoom(calendarId);
      await client.join(room);
      return { ok: true, room };
    } catch {
      return { ok: false, error: 'Forbidden' };
    }
  }

  @SubscribeMessage('calendar:leave')
  async leaveCalendar(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { calendarId?: string },
  ): Promise<{ ok: boolean }> {
    this.requireUser(client);
    const calendarId = body?.calendarId?.trim();
    if (calendarId) {
      await client.leave(calendarRoom(calendarId));
    }
    return { ok: true };
  }

  @SubscribeMessage('finance:join')
  async joinFinance(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { spaceId?: string },
  ): Promise<{ ok: boolean; room?: string; error?: string }> {
    const user = this.requireUser(client);
    const spaceId = body?.spaceId?.trim();
    if (!spaceId) {
      return { ok: false, error: 'spaceId required' };
    }

    try {
      await this.spacesService.assertMembership(
        user.userId,
        spaceId,
        FinanceMemberRole.VIEWER,
      );
      const room = financeRoom(spaceId);
      await client.join(room);
      return { ok: true, room };
    } catch {
      return { ok: false, error: 'Forbidden' };
    }
  }

  @SubscribeMessage('finance:leave')
  async leaveFinance(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { spaceId?: string },
  ): Promise<{ ok: boolean }> {
    this.requireUser(client);
    const spaceId = body?.spaceId?.trim();
    if (spaceId) {
      await client.leave(financeRoom(spaceId));
    }
    return { ok: true };
  }

  private requireUser(client: Socket): SocketUser {
    const user = client.data.user as SocketUser | undefined;
    if (!user?.userId) {
      throw new Error('Unauthorized');
    }
    return user;
  }

  private async authenticate(client: Socket): Promise<SocketUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new Error('Missing token');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: getRequiredJwtSecret(),
    });

    if (!payload.sub || !payload.sessionId) {
      throw new Error('Invalid token payload');
    }

    await this.authService.assertActiveSession(payload.sub, payload.sessionId);

    return {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
    };
  }

  private extractToken(client: Socket): string | null {
    const fromAuth = client.handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.trim()) {
      return fromAuth.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }

    return null;
  }
}
