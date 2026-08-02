import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { GetProfileDto } from './dto/get-profile.dto';
import { GetUsersDto } from './dto/get-users.dto';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import {
  RecoverPasswordDto,
  RequestPasswordRecoverDto,
} from './dto/password-recover.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.dto';
import { PublicRegisterDto, RegisterDto } from './dto/register-user.dto';
import { UpdateNameDto } from './dto/update-name.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { ValidateAccessTokenResponseDto } from './dto/validate-access-token.dto';
import { UserRoleDto } from './dto/role-definition.dto';
import { RoleDefinitionService } from './role-definition.service';
import { PermissionType } from './roles/permission-type.enum';
import { Role } from './roles/role.enum';
import { isAdminRole } from './roles/role.utils';
import { UserToken } from './entities/user-token.entity';
import { User } from './entities/user.entity';
import { EmailService } from 'src/email/email.service';
import { getRequiredJwtSecret } from './utils/jwt-secret.util';

/**
 * Email zod schema for validating user input data.
 */
const emailSchema = z.string().email({ message: 'Invalid email format' });
const passwordSchema = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters long' })
  .max(16, { message: 'Password must be at most 16 characters long' })
  .regex(/[a-zA-Z]/, { message: 'Password must contain at least one letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one number' });
const recoveryCodeSchema = z
  .string()
  .length(6, { message: 'Recovery code must be exactly 6 characters long' })
  .regex(/^[A-Z0-9]+$/, {
    message: 'Recovery code must contain only uppercase letters and numbers',
  });

type JwtAuthPayload = {
  sub: string;
  email: string;
  role: string;
  permissionType: PermissionType;
  sessionId?: string;
};

type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

type LoginSessionResponse = LoginResponseDto & {
  refreshToken: string;
};

type UpdateUserStatusPayload = {
  id: string;
  isActive: boolean;
};

/**
 * Authentication service handling user registration, login, token management,
 * password recovery, profile updates, and user management.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret = getRequiredJwtSecret();
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(UserToken)
    private readonly userTokenRepository: Repository<UserToken>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly roleDefinitionService: RoleDefinitionService,
  ) {}

  /**
   * Registers a new user if the requester has admin privileges.
   *
   * @param userData Data of the user to be registered
   * @param creatorUserId UUID of the admin user creating this record
   * @returns void
   */
  async register(userData: RegisterDto, creatorUserId: string): Promise<void> {
    const creatorUser = await this.userRepository.findOne({
      where: { id: creatorUserId },
    });
    if (!creatorUser || !isAdminRole(creatorUser.role)) {
      throw new UnauthorizedException(
        'You do not have permission to register users',
      );
    }
    if (!creatorUser.id) {
      throw new UnauthorizedException('Creator user is invalid');
    }

    emailSchema.parse(userData.email);
    passwordSchema.parse(userData.password);

    const foundUser = await this.findUserByEmail(userData.email);
    if (foundUser) {
      throw new ConflictException('User already exists');
    }

    const roleDefinition =
      await this.roleDefinitionService.ensureAssignableRole(userData.role);

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = this.userRepository.create({
      first_name: userData.firstName.trim(),
      last_name: userData.lastName.trim(),
      email: userData.email.trim().toLowerCase(),
      is_active: false,
      role: roleDefinition.code,
      password_hash: hashedPassword,
      created_by: creatorUser.id,
    });

    await this.userRepository.save(newUser);
    await this.sendAccountCreatedNotification(newUser);
  }

  /**
   * Registers a new user from the public authentication flow.
   * Always assigns the system USER role.
   *
   * @param userData Data of the user to be registered
   * @returns void
   */
  async publicRegister(userData: PublicRegisterDto): Promise<void> {
    const roleDefinition =
      await this.roleDefinitionService.ensureAssignableRole(Role.USER);
    if (roleDefinition.permission_type !== PermissionType.USER) {
      throw new BadRequestException(
        'Default public registration role is not available',
      );
    }

    emailSchema.parse(userData.email);
    passwordSchema.parse(userData.password);

    const foundUser = await this.findUserByEmail(userData.email);
    // Avoid account enumeration: same outcome whether the email exists or not.
    if (foundUser) {
      await bcrypt.hash(userData.password, 10);
      return;
    }

    const newUserId = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = this.userRepository.create({
      id: newUserId,
      first_name: userData.firstName.trim(),
      last_name: userData.lastName.trim(),
      email: userData.email.trim().toLowerCase(),
      is_active: false,
      role: roleDefinition.code,
      password_hash: hashedPassword,
      created_by: newUserId,
    });

    await this.userRepository.save(newUser);
    await this.sendAccountCreatedNotification(newUser);
  }

  /**
   * Authenticates a user and generates JWT access and refresh tokens.
   *
   * @param userData Login data containing email and password
   * @returns Login response containing access token, refresh token, and user details
   */
  async login(userData: LoginDto): Promise<LoginSessionResponse> {
    emailSchema.parse(userData.email);
    passwordSchema.parse(userData.password);

    const foundUser = await this.findUserByEmail(userData.email);
    if (
      !foundUser ||
      !(await bcrypt.compare(userData.password, foundUser.password_hash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Same generic message for inactive accounts to avoid confirming valid
    // credentials to an attacker. Log the real reason server-side only.
    if (!foundUser.is_active) {
      this.logger.warn(`Login blocked for inactive user ${foundUser.id}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const permissionType =
      await this.roleDefinitionService.resolvePermissionType(foundUser.role);
    const payload: JwtAuthPayload = {
      email: foundUser.email,
      sub: foundUser.id,
      role: foundUser.role,
      permissionType,
      sessionId: crypto.randomUUID(),
    };

    const {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    } = this.createSessionTokens(payload);

    const session = this.userTokenRepository.create({
      session_id: payload.sessionId,
      user_id: payload.sub,
      access_token_expires_at: accessTokenExpiresAt,
      refresh_token_hash: await bcrypt.hash(refreshToken, 10),
      refresh_token_expires_at: refreshTokenExpiresAt,
    });
    await this.userTokenRepository.save(session);

    const roleDefinition =
      await this.roleDefinitionService.ensureAssignableRole(foundUser.role);

    return {
      accessToken,
      refreshToken,
      firstName: foundUser.first_name,
      lastName: foundUser.last_name,
      role: roleDefinition.code,
      roleName: roleDefinition.name,
      permissionType: roleDefinition.permission_type,
    };
  }

  /**
   * Refreshes JWT access and refresh tokens using a valid refresh token.
   *
   * @param userData Data containing the refresh token
   * @returns New access and refresh tokens
   */
  async refreshToken(refreshTokenValue: string): Promise<
    RefreshTokenResponseDto & { refreshToken: string }
  > {
    if (!refreshTokenValue) {
      throw new BadRequestException('Refresh token is required');
    }

    let payload: JwtAuthPayload;
    try {
      payload = this.jwtService.verify<JwtAuthPayload>(refreshTokenValue, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.sessionId) {
      throw new UnauthorizedException('Refresh token session is invalid');
    }

    const session = await this.userTokenRepository.findOne({
      where: { session_id: payload.sessionId, user_id: payload.sub },
    });

    if (
      !session ||
      !session.refresh_token_expires_at ||
      session.refresh_token_expires_at.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'Refresh token is invalid or has expired',
      );
    }

    const refreshMatches = await bcrypt.compare(
      refreshTokenValue,
      session.refresh_token_hash,
    );
    if (!refreshMatches) {
      await this.userTokenRepository.delete({ id: session.id });
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Token does not belong to a valid user');
    }

    const permissionType =
      await this.roleDefinitionService.resolvePermissionType(user.role);
    const nextPayload: JwtAuthPayload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      permissionType,
      sessionId: session.session_id,
    };

    const {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    } = this.createSessionTokens(nextPayload);

    session.access_token_expires_at = accessTokenExpiresAt;
    session.refresh_token_hash = await bcrypt.hash(refreshToken, 10);
    session.refresh_token_expires_at = refreshTokenExpiresAt;
    await this.userTokenRepository.save(session);

    return { accessToken, refreshToken };
  }

  /**
   * Validates the provided JWT access token.
   *
   * @param accessToken The JWT access token to validate
   * @returns Validation response indicating token validity
   */
  async validateAccessToken(
    accessToken: string,
  ): Promise<ValidateAccessTokenResponseDto> {
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }

    let payload: JwtAuthPayload;
    try {
      payload = this.jwtService.verify<JwtAuthPayload>(accessToken, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (!payload.sessionId) {
      throw new UnauthorizedException('Access token session is invalid');
    }

    const session = await this.assertActiveSession(payload.sub, payload.sessionId);

    if (
      !session.access_token_expires_at ||
      session.access_token_expires_at < new Date()
    ) {
      throw new UnauthorizedException('Access token has expired');
    }

    return {
      expiresAt: session.access_token_expires_at,
    };
  }

  /**
   * Logs out a user by invalidating only the current session.
   *
   * @param userId The ID of the user to log out
   * @param accessToken Access token of the current session
   * @returns void
   */
  async logout(userId: string, sessionId: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.userTokenRepository.delete({
      user_id: userId,
      session_id: sessionId,
    });
  }

  /**
   * Finds a user by their email address.
   *
   * @param email The email address of the user to find
   * @returns The user if found, otherwise null
   */
  private async findUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  /**
   * Sends a password recovery code to the user's email.
   *
   * @param userData Data containing the user's email
   * @returns void
   */
  async requestPasswordRecover(
    userData: RequestPasswordRecoverDto,
  ): Promise<void> {
    emailSchema.parse(userData.email);

    const user = await this.findUserByEmail(userData.email);
    if (!user) {
      return;
    }

    const recoveryCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    user.recovery_code = await bcrypt.hash(recoveryCode, 10);
    user.recovery_code_expires_at = new Date(Date.now() + 15 * 60 * 1000);
    user.recovery_attempts = 0;
    await this.userRepository.save(user);

    await this.emailService.sendRecoveryEmail(userData.email, recoveryCode);
  }

  /**
   * Resets the user's password using the provided recovery code and new password.
   *
   * @param userData Data containing email, recovery code, and new password
   * @returns void
   */
  async recoverPassword(userData: RecoverPasswordDto): Promise<void> {
    emailSchema.parse(userData.email);
    passwordSchema.parse(userData.newPassword);
    recoveryCodeSchema.parse(userData.recoveryCode);

    const user = await this.findUserByEmail(userData.email);
    if (!user || !user.recovery_code || !user.recovery_code_expires_at) {
      throw new UnauthorizedException('Invalid or expired recovery code');
    }

    if (
      user.recovery_code_expires_at < new Date() ||
      user.recovery_attempts >= 5
    ) {
      user.recovery_code = null;
      user.recovery_code_expires_at = null;
      user.recovery_attempts = 0;
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid or expired recovery code');
    }

    const recoveryCodeMatches = await bcrypt.compare(
      userData.recoveryCode,
      user.recovery_code,
    );
    if (!recoveryCodeMatches) {
      user.recovery_attempts += 1;
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid or expired recovery code');
    }

    user.password_hash = await bcrypt.hash(userData.newPassword, 10);
    user.recovery_code = null;
    user.recovery_code_expires_at = null;
    user.recovery_attempts = 0;
    await this.userRepository.save(user);

    await this.userTokenRepository.delete({ user_id: user.id });
  }

  /**
   * Updates the first and last name of the user.
   *
   * @param userId The ID of the user to update
   * @param userData Data containing the new first and last name
   * @returns void
   */
  async updateName(userId: string, userData: UpdateNameDto): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.first_name = userData.firstName.trim();
    user.last_name = userData.lastName.trim();
    await this.userRepository.save(user);
  }

  /**
   * Changes the password of the user.
   *
   * @param userId The ID of the user whose password is to be changed
   * @param userData Data containing the current and new password
   * @returns void
   */
  async changePassword(
    userId: string,
    userData: ChangePasswordDto,
  ): Promise<void> {
    passwordSchema.parse(userData.newPassword);
    passwordSchema.parse(userData.currentPassword);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (
      !user ||
      !(await bcrypt.compare(userData.currentPassword, user.password_hash))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.password_hash = await bcrypt.hash(userData.newPassword, 10);
    await this.userRepository.save(user);

    await this.userTokenRepository.delete({ user_id: userId });
  }

  /**
   * Retrieves the role of the user based on their ID.
   *
   * @param userId The ID of the user whose role is to be retrieved
   * @returns The role of the user
   */
  async getRole(userId: string): Promise<UserRoleDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleDefinition =
      await this.roleDefinitionService.ensureAssignableRole(user.role);
    return {
      code: roleDefinition.code,
      name: roleDefinition.name,
      permissionType: roleDefinition.permission_type,
    };
  }

  /**
   * Retrieves the authenticated user's personal profile.
   *
   * @param userId The ID of the authenticated user
   * @returns Profile data for the current user
   */
  async getProfile(userId: string): Promise<GetProfileDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleDefinition =
      await this.roleDefinitionService.ensureAssignableRole(user.role);

    return {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: roleDefinition.code,
      roleName: roleDefinition.name,
      permissionType: roleDefinition.permission_type,
    };
  }

  /**
   * Retrieves a list of all users with their basic information.
   *
   * @returns List of users
   */
  async getUsers(): Promise<GetUsersDto[]> {
    const users = await this.userRepository.find();
    return Promise.all(
      users.map(async (user) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        isActive: user.is_active,
        role: user.role,
        roleName: await this.roleDefinitionService.getRoleLabel(user.role),
      })),
    );
  }

  /**
   * Updates the active status for a user account.
   *
   * @param userId The admin user performing the action
   * @param userData Data containing target user id and new active status
   * @returns void
   */
  async updateUserStatus(
    userId: string,
    userData: UpdateUserStatusPayload,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !isAdminRole(user.role)) {
      throw new UnauthorizedException(
        'You do not have permission to update users',
      );
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: userData.id },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const wasActive = targetUser.is_active;
    if (wasActive === userData.isActive) {
      return;
    }

    targetUser.is_active = userData.isActive;
    await this.userRepository.save(targetUser);

    if (!targetUser.is_active) {
      await this.userTokenRepository.delete({ user_id: targetUser.id });
      return;
    }

    await this.sendAccountActivatedNotification(targetUser);
  }

  /**
   * Updates the assigned role for a user account.
   *
   * @param userId The admin user performing the action
   * @param userData Data containing target user id and new role code
   * @returns void
   */
  async updateUserRole(
    userId: string,
    userData: UpdateUserRoleDto,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !isAdminRole(user.role)) {
      throw new UnauthorizedException(
        'You do not have permission to update users',
      );
    }

    if (user.id === userData.id) {
      throw new BadRequestException('You cannot update your own role');
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: userData.id },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const roleDefinition =
      await this.roleDefinitionService.ensureAssignableRole(userData.role);
    if (
      targetUser.role === Role.ADMIN &&
      roleDefinition.code !== Role.ADMIN
    ) {
      throw new BadRequestException(
        'No es posible cambiar el rol de un usuario Administrador',
      );
    }

    if (targetUser.role === roleDefinition.code) {
      return;
    }

    targetUser.role = roleDefinition.code;
    await this.userRepository.save(targetUser);
    await this.userTokenRepository.delete({ user_id: targetUser.id });
  }

  /**
   * Deletes a user specified by the deleteUserDto.
   *
   * @param userId The ID of the admin user making the request
   * @param userData Data containing the ID of the user to be deleted
   * @returns void
   */
  async deleteUser(userId: string, userData: DeleteUserDto): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !isAdminRole(user.role)) {
      throw new UnauthorizedException(
        'You do not have permission to delete users',
      );
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: userData.id },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }
    if (isAdminRole(targetUser.role)) {
      throw new UnauthorizedException(
        'You do not have permission to delete this user',
      );
    }

    await this.userTokenRepository.delete({ user_id: targetUser.id });
    await this.userRepository.remove(targetUser);
  }

  private async sendAccountCreatedNotification(user: User): Promise<void> {
    try {
      await this.emailService.sendAccountCreatedEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        await this.roleDefinitionService.getRoleLabel(user.role),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `No se pudo enviar correo de cuenta creada a ${user.email}: ${message}`,
      );
    }
  }

  private async sendAccountActivatedNotification(user: User): Promise<void> {
    try {
      await this.emailService.sendAccountActivatedEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        await this.roleDefinitionService.getRoleLabel(user.role),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `No se pudo enviar correo de activación a ${user.email}: ${message}`,
      );
    }
  }

  async assertActiveSession(
    userId: string,
    sessionId: string,
  ): Promise<UserToken> {
    const session = await this.userTokenRepository.findOne({
      where: { session_id: sessionId, user_id: userId },
      relations: { user: true },
    });

    if (
      !session ||
      !session.user?.is_active ||
      session.refresh_token_expires_at < new Date()
    ) {
      throw new UnauthorizedException('Session is inactive or has expired');
    }

    return session;
  }

  private createSessionTokens(payload: JwtAuthPayload): SessionTokens {
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '2h',
      secret: this.jwtSecret,
      jwtid: crypto.randomUUID(),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: this.jwtSecret,
      jwtid: crypto.randomUUID(),
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: this.decodeTokenExpiration(accessToken),
      refreshTokenExpiresAt: this.decodeTokenExpiration(refreshToken),
    };
  }

  private decodeTokenExpiration(token: string): Date {
    const decodedToken = this.jwtService.decode(token);
    if (!decodedToken?.exp) {
      throw new UnauthorizedException('Unable to decode token expiration');
    }

    return new Date(decodedToken.exp * 1000);
  }
}
