/**
 * DTO para listar información de usuarios.
 */
export class GetUsersDto {
  /**
   * Identificador único del usuario.
   */
  id!: string;
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
   * Indica si la cuenta está activa.
   */
  isActive!: boolean;
  /**
   * Código de rol del usuario.
   */
  role!: string;
  /**
   * Nombre visible del rol del usuario.
   */
  roleName!: string;
}
