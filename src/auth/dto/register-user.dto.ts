import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO para registrar usuarios.
 */
export class RegisterDto {
  /**
   * Nombre del usuario.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  firstName!: string;
  /**
   * Apellido del usuario.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;
  /**
   * Correo electrónico del usuario.
   */
  @IsEmail()
  email!: string;
  /**
   * Contraseña del usuario.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/[a-zA-Z]/)
  @Matches(/[0-9]/)
  password!: string;
  /**
   * Código de rol asignado al usuario.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  role!: string;
}

/**
 * DTO para registro público (sin rol: se asigna USER por defecto).
 */
export class PublicRegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/[a-zA-Z]/)
  @Matches(/[0-9]/)
  password!: string;
}
