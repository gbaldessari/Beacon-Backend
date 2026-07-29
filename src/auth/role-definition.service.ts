import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateRoleDefinitionDto,
  RoleDefinitionDto,
} from './dto/role-definition.dto';
import { RoleDefinition } from './entities/role-definition.entity';
import { User } from './entities/user.entity';
import { PermissionType } from './roles/permission-type.enum';
import { Role } from './roles/role.enum';
import { isAdminRole } from './roles/role.utils';

@Injectable()
export class RoleDefinitionService {
  constructor(
    @InjectRepository(RoleDefinition)
    private readonly roleDefinitionRepository: Repository<RoleDefinition>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async listRoles(): Promise<RoleDefinitionDto[]> {
    const roles = await this.roleDefinitionRepository.find({
      order: { is_system: 'DESC', name: 'ASC' },
    });

    return roles.map((role) => this.toDto(role));
  }

  async listPublicRegistrationRoles(): Promise<RoleDefinitionDto[]> {
    const roles = await this.roleDefinitionRepository.find({
      where: { permission_type: PermissionType.USER },
      order: { is_system: 'DESC', name: 'ASC' },
    });

    return roles.map((role) => this.toDto(role));
  }

  async createRole(
    creatorUserId: string,
    payload: CreateRoleDefinitionDto,
  ): Promise<RoleDefinitionDto> {
    const creator = await this.userRepository.findOne({
      where: { id: creatorUserId },
    });
    if (!creator || !isAdminRole(creator.role)) {
      throw new UnauthorizedException(
        'You do not have permission to create roles',
      );
    }

    const trimmedName = payload.name.trim();
    if (trimmedName.length < 2) {
      throw new BadRequestException(
        'Role name must have at least 2 characters',
      );
    }

    const existingByName = await this.roleDefinitionRepository.findOne({
      where: { name: trimmedName },
    });
    if (existingByName) {
      throw new ConflictException('A role with this name already exists');
    }

    const code = await this.generateUniqueCode(trimmedName);
    const role = this.roleDefinitionRepository.create({
      code,
      name: trimmedName,
      permission_type: payload.permissionType,
      is_system: false,
      created_by: creatorUserId,
    });

    const savedRole = await this.roleDefinitionRepository.save(role);
    return this.toDto(savedRole);
  }

  async deleteRole(creatorUserId: string, roleId: string): Promise<void> {
    const creator = await this.userRepository.findOne({
      where: { id: creatorUserId },
    });
    if (!creator || !isAdminRole(creator.role)) {
      throw new UnauthorizedException(
        'You do not have permission to delete roles',
      );
    }

    const role = await this.roleDefinitionRepository.findOne({
      where: { id: roleId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.is_system) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    const assignedUsers = await this.userRepository.count({
      where: { role: role.code },
    });
    if (assignedUsers > 0) {
      throw new BadRequestException(
        'Cannot delete a role that is assigned to users',
      );
    }

    await this.roleDefinitionRepository.remove(role);
  }

  async findByCode(code: string): Promise<RoleDefinition | null> {
    return this.roleDefinitionRepository.findOne({ where: { code } });
  }

  async getRoleLabel(code: string): Promise<string> {
    const role = await this.findByCode(code);
    return role?.name ?? code;
  }

  async resolvePermissionType(code: string): Promise<PermissionType> {
    const role = await this.findByCode(code);
    if (!role) {
      throw new BadRequestException('Role is not valid');
    }

    return role.permission_type;
  }

  async ensureAssignableRole(code: string): Promise<RoleDefinition> {
    const role = await this.findByCode(code);
    if (!role) {
      throw new BadRequestException('Role is not valid');
    }

    return role;
  }

  private async generateUniqueCode(name: string): Promise<string> {
    const baseCode = this.normalizeCode(name);
    let candidate = baseCode;
    let suffix = 1;

    while (
      await this.roleDefinitionRepository.findOne({
        where: { code: candidate },
      })
    ) {
      candidate = `${baseCode}_${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private normalizeCode(name: string): string {
    const normalized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 56);

    if (!normalized) {
      throw new BadRequestException('Role name must contain valid characters');
    }

    if (Object.values(Role).includes(normalized as Role)) {
      return `${normalized}_CUSTOM`;
    }

    return normalized;
  }

  private toDto(role: RoleDefinition): RoleDefinitionDto {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      permissionType: role.permission_type,
      isSystem: role.is_system,
    };
  }
}
