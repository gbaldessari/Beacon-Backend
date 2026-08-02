import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { User } from 'src/auth/entities/user.entity';
import { NotificationType } from 'src/notifications/notifications.enums';
import { NotificationsService } from 'src/notifications/notifications.service';
import { RealtimeEventsService } from 'src/realtime/realtime-events.service';
import { In, Repository } from 'typeorm';
import {
  CalendarInviteStatus,
  CalendarMemberRole,
  CalendarType,
} from './calendar.enums';
import {
  CreateCalendarDto,
  CreateCalendarInviteDto,
  UpdateCalendarDto,
  UpdateCalendarMemberRoleDto,
} from './dto/calendar.dto';
import { CalendarInvite } from './entities/calendar-invite.entity';
import { CalendarMember } from './entities/calendar-member.entity';
import { Calendar } from './entities/calendar.entity';

export type CalendarView = {
  id: string;
  name: string;
  color: string;
  type: CalendarType;
  role: CalendarMemberRole;
  createdAt: string;
};

export type CalendarMemberView = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: CalendarMemberRole;
  createdAt: string;
};

export type CalendarInviteView = {
  id: string;
  email: string;
  role: CalendarMemberRole;
  status: CalendarInviteStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
  calendarId?: string;
  calendarName?: string;
};

const ROLE_RANK: Record<CalendarMemberRole, number> = {
  [CalendarMemberRole.VIEWER]: 1,
  [CalendarMemberRole.EDITOR]: 2,
  [CalendarMemberRole.OWNER]: 3,
};

const DEFAULT_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#b45309',
  '#7c3aed',
  '#be123c',
  '#047857',
];

@Injectable()
export class CalendarsService {
  private readonly logger = new Logger(CalendarsService.name);

  constructor(
    @InjectRepository(Calendar)
    private readonly calendarsRepo: Repository<Calendar>,
    @InjectRepository(CalendarMember)
    private readonly membersRepo: Repository<CalendarMember>,
    @InjectRepository(CalendarInvite)
    private readonly invitesRepo: Repository<CalendarInvite>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => RealtimeEventsService))
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  private notifyCalendar(
    calendarId: string,
    reason: string,
    actorId?: string,
  ): void {
    this.realtimeEvents.emitCalendarSync({ calendarId, reason, actorId });
  }

  async ensurePersonalCalendar(userId: string): Promise<CalendarView> {
    const personal = await this.membersRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.calendar', 'calendar')
      .where('member.user_id = :userId', { userId })
      .andWhere('calendar.type = :type', { type: CalendarType.PERSONAL })
      .getOne();

    if (personal) {
      return this.toCalendarView(personal.calendar, personal.role);
    }

    const calendar = await this.calendarsRepo.save(
      this.calendarsRepo.create({
        name: 'Personal',
        color: DEFAULT_COLORS[0],
        type: CalendarType.PERSONAL,
        created_by: userId,
      }),
    );

    await this.membersRepo.save(
      this.membersRepo.create({
        calendar_id: calendar.id,
        user_id: userId,
        role: CalendarMemberRole.OWNER,
      }),
    );

    return this.toCalendarView(calendar, CalendarMemberRole.OWNER);
  }

  async listCalendars(userId: string): Promise<CalendarView[]> {
    await this.ensurePersonalCalendar(userId);

    const memberships = await this.membersRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.calendar', 'calendar')
      .where('member.user_id = :userId', { userId })
      .orderBy('calendar.type', 'ASC')
      .addOrderBy('calendar.name', 'ASC')
      .getMany();

    return memberships.map((m) => this.toCalendarView(m.calendar, m.role));
  }

  async createCalendar(
    userId: string,
    dto: CreateCalendarDto,
  ): Promise<CalendarView> {
    const color =
      dto.color ??
      DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];

    const calendar = await this.calendarsRepo.save(
      this.calendarsRepo.create({
        name: dto.name.trim(),
        color,
        type: CalendarType.SHARED,
        created_by: userId,
      }),
    );

    await this.membersRepo.save(
      this.membersRepo.create({
        calendar_id: calendar.id,
        user_id: userId,
        role: CalendarMemberRole.OWNER,
      }),
    );

    return this.toCalendarView(calendar, CalendarMemberRole.OWNER);
  }

  async updateCalendar(
    userId: string,
    calendarId: string,
    dto: UpdateCalendarDto,
  ): Promise<CalendarView> {
    await this.assertMembership(userId, calendarId, CalendarMemberRole.OWNER);
    const calendar = await this.findCalendarOrFail(calendarId);

    if (dto.name !== undefined) calendar.name = dto.name.trim();
    if (dto.color !== undefined) calendar.color = dto.color;
    await this.calendarsRepo.save(calendar);

    this.notifyCalendar(calendarId, 'calendar:updated', userId);
    return this.toCalendarView(calendar, CalendarMemberRole.OWNER);
  }

  async deleteCalendar(userId: string, calendarId: string): Promise<void> {
    await this.assertMembership(userId, calendarId, CalendarMemberRole.OWNER);
    const calendar = await this.findCalendarOrFail(calendarId);
    if (calendar.type === CalendarType.PERSONAL) {
      throw new BadRequestException('No se puede eliminar el calendario personal.');
    }
    const memberIds = await this.getCalendarMemberUserIds(calendarId);
    await this.calendarsRepo.remove(calendar);
    this.realtimeEvents.emitUserCalendarsMany(memberIds, {
      reason: 'calendar:deleted',
    });
  }

  async assertMembership(
    userId: string,
    calendarId: string,
    minRole: CalendarMemberRole = CalendarMemberRole.VIEWER,
  ): Promise<CalendarMember> {
    const membership = await this.membersRepo.findOne({
      where: { calendar_id: calendarId, user_id: userId },
    });

    if (!membership) {
      throw new ForbiddenException('No tienes acceso a este calendario.');
    }

    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(
        'No tienes permisos suficientes en este calendario.',
      );
    }

    return membership;
  }

  async getMemberCalendarIds(userId: string): Promise<string[]> {
    await this.ensurePersonalCalendar(userId);
    const memberships = await this.membersRepo.find({
      where: { user_id: userId },
    });
    return memberships.map((m) => m.calendar_id);
  }

  async getCalendarMemberUserIds(calendarId: string): Promise<string[]> {
    const memberships = await this.membersRepo.find({
      where: { calendar_id: calendarId },
      select: ['user_id'],
    });
    return memberships.map((m) => m.user_id);
  }

  async getCalendarsByIds(ids: string[]): Promise<Map<string, Calendar>> {
    if (!ids.length) return new Map();
    const calendars = await this.calendarsRepo.find({
      where: { id: In(ids) },
    });
    return new Map(calendars.map((c) => [c.id, c]));
  }

  async listMembers(
    userId: string,
    calendarId: string,
  ): Promise<CalendarMemberView[]> {
    await this.assertMembership(userId, calendarId, CalendarMemberRole.VIEWER);

    const members = await this.membersRepo.find({
      where: { calendar_id: calendarId },
      order: { created_at: 'ASC' },
    });

    const userIds = members.map((m) => m.user_id);
    const users = userIds.length
      ? await this.usersRepo
          .createQueryBuilder('user')
          .where('user.id IN (:...userIds)', { userIds })
          .getMany()
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return members.map((m) => {
      const user = byId.get(m.user_id);
      return {
        id: m.id,
        userId: m.user_id,
        email: user?.email ?? '',
        firstName: user?.first_name ?? '',
        lastName: user?.last_name ?? '',
        role: m.role,
        createdAt: m.created_at.toISOString(),
      };
    });
  }

  async updateMemberRole(
    actorId: string,
    calendarId: string,
    targetUserId: string,
    dto: UpdateCalendarMemberRoleDto,
  ): Promise<CalendarMemberView[]> {
    await this.assertMembership(actorId, calendarId, CalendarMemberRole.OWNER);

    if (dto.role === CalendarMemberRole.OWNER) {
      throw new BadRequestException('No se puede asignar owner de esta forma.');
    }

    const target = await this.membersRepo.findOne({
      where: { calendar_id: calendarId, user_id: targetUserId },
    });
    if (!target) {
      throw new NotFoundException('Miembro no encontrado.');
    }
    if (target.role === CalendarMemberRole.OWNER) {
      throw new BadRequestException('No puedes cambiar el rol del propietario.');
    }

    target.role = dto.role;
    await this.membersRepo.save(target);
    this.notifyCalendar(calendarId, 'calendar:member_changed', actorId);
    this.realtimeEvents.emitUserCalendars(targetUserId, {
      reason: 'calendar:member_changed',
    });
    return this.listMembers(actorId, calendarId);
  }

  async removeMember(
    actorId: string,
    calendarId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertMembership(actorId, calendarId, CalendarMemberRole.OWNER);
    const target = await this.membersRepo.findOne({
      where: { calendar_id: calendarId, user_id: targetUserId },
    });
    if (!target) {
      throw new NotFoundException('Miembro no encontrado.');
    }
    if (target.role === CalendarMemberRole.OWNER) {
      throw new BadRequestException('No puedes eliminar al propietario.');
    }
    await this.membersRepo.remove(target);
    this.notifyCalendar(calendarId, 'calendar:member_removed', actorId);
    this.realtimeEvents.emitUserCalendars(targetUserId, {
      reason: 'calendar:member_removed',
    });
  }

  async createInvite(
    userId: string,
    calendarId: string,
    dto: CreateCalendarInviteDto,
  ): Promise<CalendarInviteView> {
    await this.assertMembership(userId, calendarId, CalendarMemberRole.OWNER);
    const calendar = await this.findCalendarOrFail(calendarId);

    if (calendar.type !== CalendarType.SHARED) {
      throw new BadRequestException(
        'Solo se pueden invitar miembros a calendarios compartidos.',
      );
    }
    if (dto.role === CalendarMemberRole.OWNER) {
      throw new BadRequestException('No se puede invitar como propietario.');
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.usersRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (existingUser) {
      const already = await this.membersRepo.findOne({
        where: { calendar_id: calendarId, user_id: existingUser.id },
      });
      if (already) {
        throw new ConflictException('Ese usuario ya es miembro del calendario.');
      }
    }

    const pending = await this.invitesRepo.findOne({
      where: {
        calendar_id: calendarId,
        email,
        status: CalendarInviteStatus.PENDING,
      },
    });
    if (pending && pending.expires_at > new Date()) {
      throw new ConflictException('Ya existe una invitación pendiente.');
    }

    const invite = await this.invitesRepo.save(
      this.invitesRepo.create({
        calendar_id: calendarId,
        email,
        token: randomBytes(24).toString('hex'),
        role: dto.role,
        status: CalendarInviteStatus.PENDING,
        invited_by: userId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );

    const inviter = await this.usersRepo.findOne({ where: { id: userId } });
    const inviterName = inviter
      ? `${inviter.first_name} ${inviter.last_name}`.trim()
      : 'Alguien';
    const frontend = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
    const acceptUrl = `${frontend}/invite/calendar/${invite.token}`;
    const roleLabel =
      dto.role === CalendarMemberRole.EDITOR ? 'Editor' : 'Lector';

    try {
      await this.notificationsService.notifyInvite({
        email,
        existingUserId: existingUser?.id ?? null,
        type: NotificationType.CALENDAR_INVITE,
        title: `Invitación a ${calendar.name}`,
        body: `${inviterName} te invitó al calendario ${calendar.name}`,
        link: `/invite/calendar/${invite.token}`,
        invite: {
          resourceKind: 'calendar',
          resourceName: calendar.name,
          inviterName,
          roleLabel,
          acceptUrl,
        },
        dedupeBase: `calendar_invite:${invite.id}`,
      });
    } catch (error: any) {
      this.logger.warn(
        `No se pudo notificar invitación de calendario: ${error?.message ?? error}`,
      );
    }

    if (existingUser?.id) {
      this.realtimeEvents.emitUserCalendars(existingUser.id, {
        reason: 'calendar:invite_created',
      });
    }

    return this.toInviteView(invite);
  }

  async listInvites(
    userId: string,
    calendarId: string,
  ): Promise<CalendarInviteView[]> {
    await this.assertMembership(userId, calendarId, CalendarMemberRole.OWNER);
    const invites = await this.invitesRepo.find({
      where: { calendar_id: calendarId },
      order: { created_at: 'DESC' },
    });
    return invites.map((i) => this.toInviteView(i));
  }

  async revokeInvite(
    userId: string,
    calendarId: string,
    inviteId: string,
  ): Promise<void> {
    await this.assertMembership(userId, calendarId, CalendarMemberRole.OWNER);
    const invite = await this.invitesRepo.findOne({
      where: { id: inviteId, calendar_id: calendarId },
    });
    if (!invite) {
      throw new NotFoundException('Invitación no encontrada.');
    }
    invite.status = CalendarInviteStatus.REVOKED;
    await this.invitesRepo.save(invite);
  }

  async acceptInvite(userId: string, token: string): Promise<CalendarView> {
    const invite = await this.invitesRepo.findOne({ where: { token } });
    if (!invite || invite.status !== CalendarInviteStatus.PENDING) {
      throw new NotFoundException('Invitación no válida.');
    }
    if (invite.expires_at < new Date()) {
      invite.status = CalendarInviteStatus.EXPIRED;
      await this.invitesRepo.save(invite);
      throw new BadRequestException('La invitación ha expirado.');
    }

    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenException(
        'Esta invitación no corresponde a tu cuenta.',
      );
    }

    const already = await this.membersRepo.findOne({
      where: { calendar_id: invite.calendar_id, user_id: userId },
    });
    if (!already) {
      await this.membersRepo.save(
        this.membersRepo.create({
          calendar_id: invite.calendar_id,
          user_id: userId,
          role: invite.role,
        }),
      );
    }

    invite.status = CalendarInviteStatus.ACCEPTED;
    await this.invitesRepo.save(invite);

    const calendar = await this.findCalendarOrFail(invite.calendar_id);
    this.notifyCalendar(invite.calendar_id, 'calendar:member_joined', userId);
    this.realtimeEvents.emitUserCalendars(userId, {
      reason: 'calendar:invite_accepted',
    });
    const memberIds = await this.getCalendarMemberUserIds(invite.calendar_id);
    this.realtimeEvents.emitUserCalendarsMany(
      memberIds.filter((id) => id !== userId),
      { reason: 'calendar:member_joined' },
    );
    return this.toCalendarView(calendar, invite.role);
  }

  async listPendingInvitesForUser(userId: string): Promise<CalendarInviteView[]> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) return [];

    const invites = await this.invitesRepo
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.calendar', 'calendar')
      .where('LOWER(invite.email) = :email', {
        email: user.email.toLowerCase(),
      })
      .andWhere('invite.status = :status', {
        status: CalendarInviteStatus.PENDING,
      })
      .orderBy('invite.created_at', 'DESC')
      .getMany();

    return invites
      .filter((i) => i.expires_at > new Date())
      .map((i) => ({
        ...this.toInviteView(i),
        calendarId: i.calendar_id,
        calendarName: i.calendar?.name ?? '',
      }));
  }

  private async findCalendarOrFail(calendarId: string): Promise<Calendar> {
    const calendar = await this.calendarsRepo.findOne({
      where: { id: calendarId },
    });
    if (!calendar) {
      throw new NotFoundException('Calendario no encontrado.');
    }
    return calendar;
  }

  private toCalendarView(
    calendar: Calendar,
    role: CalendarMemberRole,
  ): CalendarView {
    return {
      id: calendar.id,
      name: calendar.name,
      color: calendar.color,
      type: calendar.type,
      role,
      createdAt: calendar.created_at.toISOString(),
    };
  }

  private toInviteView(invite: CalendarInvite): CalendarInviteView {
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      token: invite.token,
      expiresAt: invite.expires_at.toISOString(),
      createdAt: invite.created_at.toISOString(),
    };
  }
}
