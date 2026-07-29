/**
 * DTO for validating an access token.
 * Contains the expiration date of the token.
 */
export class ValidateAccessTokenResponseDto {
  /**
   * Indicates the expiration date and time of the access token.
   */
  expiresAt!: Date;
}
