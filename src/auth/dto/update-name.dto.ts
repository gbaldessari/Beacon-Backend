import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO para actualizar nombre y apellido del usuario.
 */
export class UpdateNameDto {
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
}
