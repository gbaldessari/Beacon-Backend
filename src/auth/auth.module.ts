import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from 'src/email/email.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RoleDefinitionController } from './role-definition.controller';
import { RoleDefinitionService } from './role-definition.service';
import { RolesGuard } from './guard/roles.guard';
import { RoleDefinition } from './entities/role-definition.entity';
import { UserToken } from './entities/user-token.entity';
import { User } from './entities/user.entity';
import { AuthRateLimitGuard } from './guard/auth-rate-limit.guard';
import { JwtStrategy } from './strategie/jwt.strategy';
import { getRequiredJwtSecret } from './utils/jwt-secret.util';

/**
 * Construye opciones JWT desde configuración, con expiración de 2 horas.
 */
export const authJwtOptionsFactory = (configService: ConfigService) => ({
  secret: configService.get<string>('JWT_SECRET') || getRequiredJwtSecret(),
  signOptions: { expiresIn: 7200 },
});

/**
 * Módulo de autenticación y autorización.
 *
 * Registra repositorios de usuarios, sesiones y roles; configura Passport/JWT;
 * y expone servicios para login, recuperación, perfil y administración.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserToken, RoleDefinition]),
    PassportModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: authJwtOptionsFactory,
    }),
  ],
  controllers: [AuthController, RoleDefinitionController],
  providers: [
    AuthService,
    RoleDefinitionService,
    JwtStrategy,
    RolesGuard,
    AuthRateLimitGuard,
  ],
  exports: [AuthService, RoleDefinitionService],
})
export class AuthModule {}
