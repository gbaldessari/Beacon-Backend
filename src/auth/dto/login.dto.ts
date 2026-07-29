import { PermissionType } from '../roles/permission-type.enum';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for user login.
 * Contains the user's email and password.
 */
export class LoginDto {
  /**
   * User's email address.
   */
  @IsEmail()
  email!: string;
  /**
   * User's password.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  password!: string;
}

/**
 * DTO for login response.
 * Contains tokens and user details.
 */
export class LoginResponseDto {
  /**
   * Access token for authenticated requests.
   */
  accessToken!: string;
  /**
   * Refresh token cookie is issued as HttpOnly by the backend.
   */
  refreshToken?: string;
  /**
   * Nombre del usuario.
   */
  firstName!: string;
  /**
   * Apellido del usuario.
   */
  lastName!: string;
  /**
   * User's role code according to business requirements.
   */
  role!: string;
  /**
   * Display name for the user's role.
   */
  roleName!: string;
  /**
   * Permission tier associated with the user's role.
   */
  permissionType!: PermissionType;
}
