import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

type RateLimitOptions = {
  points: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_METADATA_KEY = 'authRateLimit';
const buckets = new Map<string, RateLimitEntry>();

export const AuthRateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, options);

/**
 * Rate limiter en memoria para endpoints públicos de autenticación.
 *
 * En producción con múltiples instancias conviene reemplazarlo por Redis o
 * equivalente compartido, pero evita abuso básico sin añadir infraestructura.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_METADATA_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      socket?: { remoteAddress?: string };
      body?: { email?: unknown };
      route?: { path?: string };
    }>();
    const now = Date.now();
    this.pruneExpiredBuckets(now);

    const key = this.buildKey(request, context.getHandler().name);
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return true;
    }

    if (current.count >= options.points) {
      throw new HttpException(
        'Too many attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }

  private buildKey(
    request: {
      ip?: string;
      socket?: { remoteAddress?: string };
      body?: { email?: unknown };
    },
    handlerName: string,
  ): string {
    // Prefer Express/Nest `request.ip` (respects `trust proxy` when configured).
    // Never read client-controlled `X-Forwarded-For` directly — that allows
    // rotating fake IPs and bypassing the limit.
    const ip =
      request.ip?.trim() ||
      request.socket?.remoteAddress?.trim() ||
      'unknown-ip';
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : 'anonymous';

    return `${handlerName}:${ip}:${email}`;
  }

  private pruneExpiredBuckets(now: number): void {
    for (const [key, value] of buckets.entries()) {
      if (value.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }
}
