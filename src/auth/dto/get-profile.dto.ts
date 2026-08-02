import { PermissionType } from '../roles/permission-type.enum';

/**
 * DTO for the authenticated user's profile.
 */
export class GetProfileDto {
  /**
   * Nombre del usuario.
   */
  firstName!: string;
  /**
   * Apellido del usuario.
   */
  lastName!: string;
  /**
   * Correo electrónico del usuario.
   */
  email!: string;
  /**
   * Código de rol del usuario.
   */
  role!: string;
  /**
   * Nombre visible del rol del usuario.
   */
  roleName!: string;
  /**
   * Tipo de permiso asociado al rol.
   */
  permissionType!: PermissionType;
}
