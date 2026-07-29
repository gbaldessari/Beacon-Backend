import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
/**
 * Guard used to protect routes that require JWT authentication.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
