import { IsUUID } from 'class-validator';

/**
 * DTO for deleting a user.
 * Contains the unique identifier of the user to be deleted.
 */
export class DeleteUserDto {
  /**
   * Unique identifier of the user to be deleted.
   */
  @IsUUID()
  id!: string;
}
