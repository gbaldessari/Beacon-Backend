import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { PermissionType } from '../roles/permission-type.enum';
import { isAdminRole } from '../roles/role.utils';
import { getRequiredJwtSecret } from '../utils/jwt-secret.util';

/**
 * Estrategia Passport para validar JWT en solicitudes autenticadas.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Configura extracción desde `Authorization: Bearer` y secreto de firma.
   */
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getRequiredJwtSecret(),
    });
  }

  /**
   * Valida el payload y define los datos disponibles en `req.user`.
   *
   * @param payload - Payload decodificado del JWT.
   * @returns Datos de usuario autenticado para guards y controladores.
   */
  async validate(payload: JwtPayload) {
    if (!payload.sessionId) {
      throw new UnauthorizedException('Token session is invalid');
    }

    await this.authService.assertActiveSession(payload.sub, payload.sessionId);

    const role = payload.role;
    return {
      userId: payload.sub,
      email: payload.email,
      role,
      permissionType: payload.permissionType,
      sessionId: payload.sessionId,
      isAdmin: isAdminRole(role),
    };
  }
}

/**
 * Estructura del payload JWT emitido por autenticación.
 */
export type JwtPayload = {
  /**
   * Identificador del usuario.
   */
  sub: string;
  /**
   * Correo electrónico del usuario.
   */
  email: string;
  /**
   * Código de rol vigente.
   */
  role: string;
  /**
   * Nivel de permiso asociado al rol.
   */
  permissionType?: PermissionType;
  /**
   * Identificador de sesión activa.
   */
  sessionId?: string;
};
