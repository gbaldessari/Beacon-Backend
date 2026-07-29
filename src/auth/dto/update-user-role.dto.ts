import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for updating a user's assigned role.
 */
export class UpdateUserRoleDto {
  /**
   * Unique identifier of the user to update.
   */
  @IsUUID()
  id!: string;

  /**
   * Role code to assign to the user.
   */
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  role!: string;
}
