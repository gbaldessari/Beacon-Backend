import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Res,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import {
  AuthRateLimit,
  AuthRateLimitGuard,
} from './guard/auth-rate-limit.guard';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RegisterDto } from './dto/register-user.dto';
import {
  RecoverPasswordDto,
  RequestPasswordRecoverDto,
} from './dto/password-recover.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNameDto } from './dto/update-name.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from './dto/refresh-token.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { ValidateAccessTokenResponseDto } from './dto/validate-access-token.dto';
import { GetUsersDto } from './dto/get-users.dto';
import { Roles } from './guard/roles.decorator';
import { RolesGuard } from './guard/roles.guard';
import { UserRoleDto } from './dto/role-definition.dto';
import { Role } from './roles/role.enum';

/**
 * Controlador de autenticación y gestión de usuarios.
 *
 * Incluye registro, login, validación/renovación de tokens, recuperación de
 * contraseña, perfil y administración de usuarios protegida por roles.
 */
@Controller('auth')
export class AuthController {
  private static readonly refreshCookieName = 'beacon_refresh_token';

  constructor(private readonly authService: AuthService) {}

  /**
   * Registers a new user using the provided registration data.
   *
   * @param registerDto registration data transfer object
   * @param req HTTP request object containing authenticated user
   * @returns void
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Request() req,
  ): Promise<void> {
    return await this.authService.register(registerDto, req.user.userId);
  }

  /**
   * Registers a new user from the public authentication view.
   *
   * @param registerDto registration data transfer object
   * @returns void
   */
  @Post('public-register')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({ points: 3, windowMs: 60 * 60 * 1000 })
  async publicRegister(@Body() registerDto: RegisterDto): Promise<void> {
    return await this.authService.publicRegister(registerDto);
  }

  /**
   * Authenticates a user with the provided login credentials.
   *
   * @param loginDto login data transfer object
   * @returns login response containing JWT tokens
   */
  @Patch('login')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({ points: 5, windowMs: 60 * 1000 })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<LoginResponseDto, 'refreshToken'>> {
    const { refreshToken, ...response } = await this.authService.login(
      loginDto,
    );
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  /**
   * Validates the JWT access token provided in the request header.
   *
   * @param req HTTP request object containing headers
   * @returns validation response indicating token validity
   */
  @UseGuards(JwtAuthGuard)
  @Get('validate-token')
  async validateToken(@Request() req): Promise<ValidateAccessTokenResponseDto> {
    const token = this.extractBearerToken(req);
    return await this.authService.validateAccessToken(token);
  }

  /**
   * Refreshes the JWT tokens using the provided refresh token.
   *
   * @param refreshTokenDto refresh token data transfer object
   * @returns new access and refresh tokens
   */
  @Patch('refresh-token')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({ points: 30, windowMs: 60 * 1000 })
  async refreshToken(
    @Request() req,
    @Body() _refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    const refreshToken = this.extractRefreshCookie(req);
    const response = await this.authService.refreshToken(refreshToken);
    this.setRefreshCookie(res, response.refreshToken);
    return { accessToken: response.accessToken };
  }

  /**
   * Initiates the password recovery process by sending a recovery code to the user's email.
   *
   * @param requestPasswordRecoverDto password recovery request data transfer object
   * @returns void
   */
  @Patch('request-password-reset')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({ points: 3, windowMs: 15 * 60 * 1000 })
  async requestPasswordReset(
    @Body() requestPasswordRecoverDto: RequestPasswordRecoverDto,
  ): Promise<void> {
    return await this.authService.requestPasswordRecover(
      requestPasswordRecoverDto,
    );
  }

  /**
   * Resets the user's password using the provided recovery code and new password.
   *
   * @param recoverPasswordDto password recovery data transfer object
   * @returns void
   */
  @Patch('reset-password')
  @UseGuards(AuthRateLimitGuard)
  @AuthRateLimit({ points: 5, windowMs: 15 * 60 * 1000 })
  async resetPassword(
    @Body() recoverPasswordDto: RecoverPasswordDto,
  ): Promise<void> {
    return await this.authService.recoverPassword(recoverPasswordDto);
  }

  /**
   * Logs out the authenticated user by invalidating their tokens.
   *
   * @param req HTTP request object containing user information
   * @returns void
   */
  @UseGuards(JwtAuthGuard)
  @Patch('logout')
  async logout(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(req.user.userId, req.user.sessionId);
    this.clearRefreshCookie(res);
  }

  /**
   * Retrieves the role of the authenticated user.
   *
   * @param req HTTP request object containing user information
   * @returns The role of the authenticated user
   */
  @UseGuards(JwtAuthGuard)
  @Get('get-role')
  async getRole(@Request() req): Promise<UserRoleDto> {
    return await this.authService.getRole(req.user.userId);
  }

  /**
   * Updates the name of the authenticated user.
   *
   * @param req HTTP request object containing user information
   * @param updateNameDto data transfer object containing the new name
   * @returns void
   */
  @UseGuards(JwtAuthGuard)
  @Patch('update-name')
  async updateName(
    @Request() req,
    @Body() updateNameDto: UpdateNameDto,
  ): Promise<void> {
    return await this.authService.updateName(req.user.userId, updateNameDto);
  }

  /**
   * Changes the password of the authenticated user.
   *
   * @param req HTTP request object containing user information
   * @param changePasswordDto data transfer object containing the new password details
   * @returns void
   */
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    return await this.authService.changePassword(
      req.user.userId,
      changePasswordDto,
    );
  }

  /**
   * Retrieves a list of all users.
   *
   * @returns an array of user data transfer objects
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('get-users')
  async getUsers(): Promise<GetUsersDto[]> {
    return await this.authService.getUsers();
  }

  /**
   * Updates active status for an existing user.
   *
   * @param req HTTP request object containing user information
   * @param updateUserStatusDto data transfer object with status payload
   * @returns void
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('update-user-status')
  async updateUserStatus(
    @Request() req,
    @Body() updateUserStatusDto: UpdateUserStatusDto,
  ): Promise<void> {
    return await this.authService.updateUserStatus(
      req.user.userId,
      updateUserStatusDto,
    );
  }

  /**
   * Updates assigned role for an existing user.
   *
   * @param req HTTP request object containing user information
   * @param updateUserRoleDto data transfer object with role payload
   * @returns void
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('update-user-role')
  async updateUserRole(
    @Request() req,
    @Body() updateUserRoleDto: UpdateUserRoleDto,
  ): Promise<void> {
    return await this.authService.updateUserRole(
      req.user.userId,
      updateUserRoleDto,
    );
  }

  /**
   * Deletes a user specified by the deleteUserDto.
   *
   * @param req HTTP request object containing user information
   * @param deleteUserDto data transfer object containing the ID of the user to be deleted
   * @returns void
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('delete-user')
  async deleteUser(
    @Request() req,
    @Query() deleteUserDto: DeleteUserDto,
  ): Promise<void> {
    return await this.authService.deleteUser(req.user.userId, deleteUserDto);
  }

  /**
   * Extrae el JWT desde el header `Authorization: Bearer ...`.
   */
  private extractBearerToken(req: any): string {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BadRequestException(
        'Authorization header is missing or invalid',
      );
    }

    return authHeader.split(' ')[1];
  }

  private extractRefreshCookie(req: any): string {
    const cookies = this.parseCookies(req.headers?.cookie);
    const token = cookies[AuthController.refreshCookieName];

    if (!token) {
      throw new BadRequestException('Refresh token cookie is missing');
    }

    return token;
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    const secure = this.shouldUseSecureRefreshCookie();
    res.cookie(AuthController.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    const secure = this.shouldUseSecureRefreshCookie();
    res.clearCookie(AuthController.refreshCookieName, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/',
    });
  }

  private shouldUseSecureRefreshCookie(): boolean {
    return process.env.REFRESH_COOKIE_SECURE === 'true';
  }

  private parseCookies(cookieHeader: unknown): Record<string, string> {
    if (typeof cookieHeader !== 'string') {
      return {};
    }

    return Object.fromEntries(
      cookieHeader.split(';').map((cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        return [name, decodeURIComponent(valueParts.join('='))];
      }),
    );
  }
}
