import { PermissionType } from './permission-type.enum';
import { Role } from './role.enum';

/**
 * Indica si un código de rol tiene permisos de Administrador.
 */
export function isAdminRole(role: string): boolean {
  return role === Role.ADMIN;
}

/**
 * Indica si el permiso corresponde a un usuario operacional sin privilegios administrativos.
 */
export function hasUserLevelAccess(permissionType: PermissionType): boolean {
  return permissionType === PermissionType.USER;
}
