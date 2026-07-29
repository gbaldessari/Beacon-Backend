/**
 * DTO for refreshing authentication tokens.
 *
 * The refresh token is read from an HttpOnly cookie.
 */
export class RefreshTokenDto {}

/**
 * DTO for refresh token response.
 * Contains a new access token. The rotated refresh token is set as cookie.
 */
export class RefreshTokenResponseDto {
  /**
   * New access token for authenticated requests.
   */
  accessToken!: string;
}
