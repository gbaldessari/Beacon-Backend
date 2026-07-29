import { IsBoolean, IsUUID } from 'class-validator';

/**
 * DTO for updating an user active status.
 */
export class UpdateUserStatusDto {
  /**
   * Unique identifier of the user to update.
   */
  @IsUUID()
  id!: string;

  /**
   * New active status for the user.
   */
  @IsBoolean()
  isActive!: boolean;
}
