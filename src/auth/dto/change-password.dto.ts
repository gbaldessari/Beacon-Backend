import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for changing a user's password.
 * Contains the current password and the new desired password.
 */
export class ChangePasswordDto {
  /**
   * The user's current password.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/[a-zA-Z]/)
  @Matches(/[0-9]/)
  currentPassword!: string;
  /**
   * The new password to be set for the user.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/[a-zA-Z]/)
  @Matches(/[0-9]/)
  newPassword!: string;
}
