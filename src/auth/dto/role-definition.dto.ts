import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { PermissionType } from '../roles/permission-type.enum';

export class RoleDefinitionDto {
  id!: string;
  code!: string;
  name!: string;
  permissionType!: PermissionType;
  isSystem!: boolean;
}

export class CreateRoleDefinitionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn([PermissionType.ADMIN, PermissionType.USER])
  permissionType!: PermissionType.ADMIN | PermissionType.USER;
}

export class UserRoleDto {
  code!: string;
  name!: string;
  permissionType!: PermissionType;
}
