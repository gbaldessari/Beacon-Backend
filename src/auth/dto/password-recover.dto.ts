import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for requesting a password recovery.
 * Contains the user's email.
 */
export class RequestPasswordRecoverDto {
  /**
   * User's email address.
   */
  @IsEmail()
  email!: string;
}

/**
 * DTO for recovering the password.
 * Contains the email, recovery code, and new password.
 */
export class RecoverPasswordDto {
  /**
   * User's email address.
   */
  @IsEmail()
  email!: string;
  /**
   * Recovery code sent to the user's email.
   */
  @IsString()
  @Length(6, 6)
  @Matches(/^[A-Z0-9]+$/)
  recoveryCode!: string;
  /**
   * New password to be set for the user.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/[a-zA-Z]/)
  @Matches(/[0-9]/)
  newPassword!: string;
}
