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
import { Repository } from 'typeorm';
import {
  CreateCategoryDto,
  CreateHouseholdSpaceDto,
  CreateInviteDto,
  UpdateCategoryDto,
  UpdateMemberRoleDto,
} from './dto/finance.dto';
import { FinanceCategory } from './entities/finance-category.entity';
import { FinanceSpaceInvite } from './entities/finance-space-invite.entity';
import { FinanceSpaceMember } from './entities/finance-space-member.entity';
import { FinanceSpace } from './entities/finance-space.entity';
import {
  FinanceCategoryKind,
  FinanceInviteStatus,
  FinanceMemberRole,
  FinanceSpaceType,
} from './finance.enums';

export type SpaceView = {
  id: string;
  name: string;
  type: FinanceSpaceType;
  role: FinanceMemberRole;
  createdAt: string;
};

export type MemberView = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: FinanceMemberRole;
  createdAt: string;
};

export type InviteView = {
  id: string;
  email: string;
  role: FinanceMemberRole;
  status: FinanceInviteStatus;
  token: string;
  expiresAt: string;
  createdAt: string;
};

export type CategoryView = {
  id: string;
  spaceId: string;
  parentId: string | null;
  name: string;
  kind: FinanceCategoryKind;
  color: string | null;
  children?: CategoryView[];
};

const DEFAULT_CATEGORIES: Array<{
  name: string;
  kind: FinanceCategoryKind;
  children?: Array<{ name: string; kind: FinanceCategoryKind }>;
}> = [
  {
    name: 'Ingresos',
    kind: FinanceCategoryKind.INCOME,
    children: [
      { name: 'Salario', kind: FinanceCategoryKind.INCOME },
      { name: 'Otros ingresos', kind: FinanceCategoryKind.INCOME },
    ],
  },
  {
    name: 'Vivienda',
    kind: FinanceCategoryKind.EXPENSE,
    children: [
      { name: 'Alquiler', kind: FinanceCategoryKind.EXPENSE },
      { name: 'Servicios', kind: FinanceCategoryKind.EXPENSE },
    ],
  },
  { name: 'Alimentación', kind: FinanceCategoryKind.EXPENSE },
  { name: 'Transporte', kind: FinanceCategoryKind.EXPENSE },
  { name: 'Salud', kind: FinanceCategoryKind.EXPENSE },
  { name: 'Ocio', kind: FinanceCategoryKind.EXPENSE },
  { name: 'Emergencia', kind: FinanceCategoryKind.EXPENSE },
  { name: 'Otros', kind: FinanceCategoryKind.ANY },
];

const ROLE_RANK: Record<FinanceMemberRole, number> = {
  [FinanceMemberRole.VIEWER]: 1,
  [FinanceMemberRole.EDITOR]: 2,
  [FinanceMemberRole.OWNER]: 3,
};

@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);

  constructor(
    @InjectRepository(FinanceSpace)
    private readonly spacesRepo: Repository<FinanceSpace>,
    @InjectRepository(FinanceSpaceMember)
    private readonly membersRepo: Repository<FinanceSpaceMember>,
    @InjectRepository(FinanceSpaceInvite)
    private readonly invitesRepo: Repository<FinanceSpaceInvite>,
    @InjectRepository(FinanceCategory)
    private readonly categoriesRepo: Repository<FinanceCategory>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => RealtimeEventsService))
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  private notifyFinance(spaceId: string, reason: string, actorId?: string): void {
    this.realtimeEvents.emitFinanceSync({ spaceId, reason, actorId });
  }

  async getSpaceMemberUserIds(spaceId: string): Promise<string[]> {
    const memberships = await this.membersRepo.find({
      where: { space_id: spaceId },
      select: ['user_id'],
    });
    return memberships.map((m) => m.user_id);
  }

  async ensurePersonalSpace(userId: string): Promise<SpaceView> {
    const existing = await this.membersRepo.findOne({
      where: { user_id: userId },
      relations: ['space'],
    });

    if (existing?.space?.type === FinanceSpaceType.PERSONAL) {
      return this.toSpaceView(existing.space, existing.role);
    }

    const personalMembership = await this.membersRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.space', 'space')
      .where('member.user_id = :userId', { userId })
      .andWhere('space.type = :type', { type: FinanceSpaceType.PERSONAL })
      .getOne();

    if (personalMembership) {
      return this.toSpaceView(personalMembership.space, personalMembership.role);
    }

    const space = await this.spacesRepo.save(
      this.spacesRepo.create({
        name: 'Personal',
        type: FinanceSpaceType.PERSONAL,
        created_by: userId,
      }),
    );

    await this.membersRepo.save(
      this.membersRepo.create({
        space_id: space.id,
        user_id: userId,
        role: FinanceMemberRole.OWNER,
      }),
    );

    await this.seedDefaultCategories(space.id);
    return this.toSpaceView(space, FinanceMemberRole.OWNER);
  }

  async listSpaces(userId: string): Promise<SpaceView[]> {
    await this.ensurePersonalSpace(userId);

    const memberships = await this.membersRepo
      .createQueryBuilder('member')
      .innerJoinAndSelect('member.space', 'space')
      .where('member.user_id = :userId', { userId })
      .orderBy('space.type', 'ASC')
      .addOrderBy('space.name', 'ASC')
      .getMany();

    return memberships.map((m) => this.toSpaceView(m.space, m.role));
  }

  async createHousehold(
    userId: string,
    dto: CreateHouseholdSpaceDto,
  ): Promise<SpaceView> {
    const space = await this.spacesRepo.save(
      this.spacesRepo.create({
        name: dto.name.trim(),
        type: FinanceSpaceType.HOUSEHOLD,
        created_by: userId,
      }),
    );

    await this.membersRepo.save(
      this.membersRepo.create({
        space_id: space.id,
        user_id: userId,
        role: FinanceMemberRole.OWNER,
      }),
    );

    await this.seedDefaultCategories(space.id);
    return this.toSpaceView(space, FinanceMemberRole.OWNER);
  }

  async assertMembership(
    userId: string,
    spaceId: string,
    minRole: FinanceMemberRole = FinanceMemberRole.VIEWER,
  ): Promise<FinanceSpaceMember> {
    const membership = await this.membersRepo.findOne({
      where: { space_id: spaceId, user_id: userId },
    });

    if (!membership) {
      throw new ForbiddenException('No tienes acceso a este espacio.');
    }

    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      throw new ForbiddenException(
        'No tienes permisos suficientes en este espacio.',
      );
    }

    return membership;
  }

  async listMembers(userId: string, spaceId: string): Promise<MemberView[]> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.VIEWER);

    const members = await this.membersRepo.find({
      where: { space_id: spaceId },
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
    spaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberView[]> {
    await this.assertMembership(actorId, spaceId, FinanceMemberRole.OWNER);

    if (dto.role === FinanceMemberRole.OWNER) {
      throw new BadRequestException(
        'Usa la transferencia de propiedad dedicada; no se puede asignar owner así.',
      );
    }

    const target = await this.membersRepo.findOne({
      where: { space_id: spaceId, user_id: targetUserId },
    });
    if (!target) {
      throw new NotFoundException('Miembro no encontrado.');
    }
    if (target.role === FinanceMemberRole.OWNER) {
      throw new BadRequestException('No puedes cambiar el rol del propietario.');
    }

    target.role = dto.role;
    await this.membersRepo.save(target);
    this.notifyFinance(spaceId, 'finance:member_changed', actorId);
    this.realtimeEvents.emitUserSpaces(targetUserId, {
      reason: 'finance:member_changed',
    });
    return this.listMembers(actorId, spaceId);
  }

  async removeMember(
    actorId: string,
    spaceId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.assertMembership(actorId, spaceId, FinanceMemberRole.OWNER);

    const target = await this.membersRepo.findOne({
      where: { space_id: spaceId, user_id: targetUserId },
    });
    if (!target) {
      throw new NotFoundException('Miembro no encontrado.');
    }
    if (target.role === FinanceMemberRole.OWNER) {
      throw new BadRequestException('No puedes eliminar al propietario.');
    }

    await this.membersRepo.remove(target);
    this.notifyFinance(spaceId, 'finance:member_removed', actorId);
    this.realtimeEvents.emitUserSpaces(targetUserId, {
      reason: 'finance:member_removed',
    });
  }

  async createInvite(
    userId: string,
    spaceId: string,
    dto: CreateInviteDto,
  ): Promise<InviteView> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.OWNER);

    const space = await this.spacesRepo.findOne({ where: { id: spaceId } });
    if (!space) {
      throw new NotFoundException('Espacio no encontrado.');
    }
    if (space.type !== FinanceSpaceType.HOUSEHOLD) {
      throw new BadRequestException(
        'Solo se pueden invitar miembros a espacios de hogar.',
      );
    }

    if (dto.role === FinanceMemberRole.OWNER) {
      throw new BadRequestException('No se puede invitar como propietario.');
    }

    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.usersRepo
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email })
      .getOne();
    if (existingUser) {
      const already = await this.membersRepo.findOne({
        where: { space_id: spaceId, user_id: existingUser.id },
      });
      if (already) {
        throw new ConflictException('Ese usuario ya es miembro del espacio.');
      }
    }

    const pending = await this.invitesRepo.findOne({
      where: {
        space_id: spaceId,
        email,
        status: FinanceInviteStatus.PENDING,
      },
    });
    if (pending && pending.expires_at > new Date()) {
      throw new ConflictException('Ya existe una invitación pendiente.');
    }

    const invite = await this.invitesRepo.save(
      this.invitesRepo.create({
        space_id: spaceId,
        email,
        token: randomBytes(24).toString('hex'),
        role: dto.role,
        status: FinanceInviteStatus.PENDING,
        invited_by: userId,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
    );

    const inviter = await this.usersRepo.findOne({ where: { id: userId } });
    const inviterName = inviter
      ? `${inviter.first_name} ${inviter.last_name}`.trim()
      : 'Alguien';
    const frontend = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
    const acceptUrl = `${frontend}/invite/finance/${invite.token}`;
    const roleLabel =
      dto.role === FinanceMemberRole.EDITOR ? 'Editor' : 'Lector';

    try {
      await this.notificationsService.notifyInvite({
        email,
        existingUserId: existingUser?.id ?? null,
        type: NotificationType.FINANCE_INVITE,
        title: `Invitación a ${space.name}`,
        body: `${inviterName} te invitó al espacio ${space.name}`,
        link: `/invite/finance/${invite.token}`,
        invite: {
          resourceKind: 'finance',
          resourceName: space.name,
          inviterName,
          roleLabel,
          acceptUrl,
        },
        dedupeBase: `finance_invite:${invite.id}`,
      });
    } catch (error: any) {
      this.logger.warn(
        `No se pudo notificar invitación de finanzas: ${error?.message ?? error}`,
      );
    }

    if (existingUser?.id) {
      this.realtimeEvents.emitUserSpaces(existingUser.id, {
        reason: 'finance:invite_created',
      });
    }

    return this.toInviteView(invite);
  }

  async listInvites(userId: string, spaceId: string): Promise<InviteView[]> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.OWNER);
    const invites = await this.invitesRepo.find({
      where: { space_id: spaceId },
      order: { created_at: 'DESC' },
    });
    return invites.map((i) => this.toInviteView(i));
  }

  async revokeInvite(
    userId: string,
    spaceId: string,
    inviteId: string,
  ): Promise<void> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.OWNER);
    const invite = await this.invitesRepo.findOne({
      where: { id: inviteId, space_id: spaceId },
    });
    if (!invite) {
      throw new NotFoundException('Invitación no encontrada.');
    }
    invite.status = FinanceInviteStatus.REVOKED;
    await this.invitesRepo.save(invite);
  }

  async acceptInvite(userId: string, token: string): Promise<SpaceView> {
    const invite = await this.invitesRepo.findOne({ where: { token } });
    if (!invite || invite.status !== FinanceInviteStatus.PENDING) {
      throw new NotFoundException('Invitación no válida.');
    }
    if (invite.expires_at < new Date()) {
      invite.status = FinanceInviteStatus.EXPIRED;
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
      where: { space_id: invite.space_id, user_id: userId },
    });
    if (!already) {
      await this.membersRepo.save(
        this.membersRepo.create({
          space_id: invite.space_id,
          user_id: userId,
          role: invite.role,
        }),
      );
    }

    invite.status = FinanceInviteStatus.ACCEPTED;
    await this.invitesRepo.save(invite);

    const space = await this.spacesRepo.findOne({
      where: { id: invite.space_id },
    });
    if (!space) {
      throw new NotFoundException('Espacio no encontrado.');
    }

    this.notifyFinance(invite.space_id, 'finance:member_joined', userId);
    this.realtimeEvents.emitUserSpaces(userId, {
      reason: 'finance:invite_accepted',
    });
    const memberIds = await this.getSpaceMemberUserIds(invite.space_id);
    this.realtimeEvents.emitUserSpacesMany(
      memberIds.filter((id) => id !== userId),
      { reason: 'finance:member_joined' },
    );

    return this.toSpaceView(space, invite.role);
  }

  async listPendingInvitesForUser(userId: string): Promise<
    Array<InviteView & { spaceName: string; spaceId: string }>
  > {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      return [];
    }

    const invites = await this.invitesRepo
      .createQueryBuilder('invite')
      .leftJoinAndSelect('invite.space', 'space')
      .where('LOWER(invite.email) = :email', {
        email: user.email.toLowerCase(),
      })
      .andWhere('invite.status = :status', {
        status: FinanceInviteStatus.PENDING,
      })
      .orderBy('invite.created_at', 'DESC')
      .getMany();

    return invites
      .filter((i) => i.expires_at > new Date())
      .map((i) => ({
        ...this.toInviteView(i),
        spaceId: i.space_id,
        spaceName: i.space?.name ?? '',
      }));
  }

  async listCategories(
    userId: string,
    spaceId: string,
  ): Promise<CategoryView[]> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.VIEWER);
    const categories = await this.categoriesRepo.find({
      where: { space_id: spaceId },
      order: { name: 'ASC' },
    });

    const roots = categories.filter((c) => !c.parent_id);
    const children = categories.filter((c) => c.parent_id);

    return roots.map((root) => ({
      ...this.toCategoryView(root),
      children: children
        .filter((c) => c.parent_id === root.id)
        .map((c) => this.toCategoryView(c)),
    }));
  }

  async createCategory(
    userId: string,
    spaceId: string,
    dto: CreateCategoryDto,
  ): Promise<CategoryView> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.EDITOR);

    let parent: FinanceCategory | null = null;
    if (dto.parentId) {
      parent = await this.categoriesRepo.findOne({
        where: { id: dto.parentId, space_id: spaceId },
      });
      if (!parent) {
        throw new NotFoundException('Categoría padre no encontrada.');
      }
      if (parent.parent_id) {
        throw new BadRequestException(
          'Solo se permiten 2 niveles de categorías.',
        );
      }
    }

    try {
      const category = await this.categoriesRepo.save(
        this.categoriesRepo.create({
          space_id: spaceId,
          parent_id: parent?.id ?? null,
          name: dto.name.trim(),
          kind: dto.kind ?? parent?.kind ?? FinanceCategoryKind.ANY,
          color: dto.color ?? null,
        }),
      );
      this.notifyFinance(spaceId, 'finance:category_changed', userId);
      return this.toCategoryView(category);
    } catch {
      throw new ConflictException('Ya existe una categoría con ese nombre.');
    }
  }

  async updateCategory(
    userId: string,
    spaceId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryView> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.EDITOR);
    const category = await this.categoriesRepo.findOne({
      where: { id: categoryId, space_id: spaceId },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada.');
    }

    if (dto.name !== undefined) category.name = dto.name.trim();
    if (dto.kind !== undefined) category.kind = dto.kind;
    if (dto.color !== undefined) category.color = dto.color;

    try {
      await this.categoriesRepo.save(category);
    } catch {
      throw new ConflictException('Ya existe una categoría con ese nombre.');
    }
    this.notifyFinance(spaceId, 'finance:category_changed', userId);
    return this.toCategoryView(category);
  }

  async deleteCategory(
    userId: string,
    spaceId: string,
    categoryId: string,
  ): Promise<void> {
    await this.assertMembership(userId, spaceId, FinanceMemberRole.EDITOR);
    const category = await this.categoriesRepo.findOne({
      where: { id: categoryId, space_id: spaceId },
    });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada.');
    }

    try {
      await this.categoriesRepo.remove(category);
      this.notifyFinance(spaceId, 'finance:category_changed', userId);
    } catch {
      throw new BadRequestException(
        'No se puede eliminar: hay movimientos asociados.',
      );
    }
  }

  private async seedDefaultCategories(spaceId: string): Promise<void> {
    for (const item of DEFAULT_CATEGORIES) {
      const parent = await this.categoriesRepo.save(
        this.categoriesRepo.create({
          space_id: spaceId,
          parent_id: null,
          name: item.name,
          kind: item.kind,
          color: null,
        }),
      );

      if (item.children?.length) {
        for (const child of item.children) {
          await this.categoriesRepo.save(
            this.categoriesRepo.create({
              space_id: spaceId,
              parent_id: parent.id,
              name: child.name,
              kind: child.kind,
              color: null,
            }),
          );
        }
      }
    }
  }

  private toSpaceView(space: FinanceSpace, role: FinanceMemberRole): SpaceView {
    return {
      id: space.id,
      name: space.name,
      type: space.type,
      role,
      createdAt: space.created_at.toISOString(),
    };
  }

  private toInviteView(invite: FinanceSpaceInvite): InviteView {
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

  private toCategoryView(category: FinanceCategory): CategoryView {
    return {
      id: category.id,
      spaceId: category.space_id,
      parentId: category.parent_id,
      name: category.name,
      kind: category.kind,
      color: category.color,
    };
  }
}
