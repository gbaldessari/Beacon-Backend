import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from '../roles/role.enum';

/**
 * Guard de autorización por rol.
 *
 * Lee los roles declarados con `@Roles()` y verifica que el usuario
 * autenticado por JWT tenga permiso para ejecutar el handler.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Permite handlers sin roles explícitos y bloquea accesos con rol insuficiente.
   */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const userRole = user?.role;

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
