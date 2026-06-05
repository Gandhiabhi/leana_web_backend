import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Authenticates when a valid bearer token is present but never rejects the
 * request when it is absent — used by endpoints that serve both guests and
 * logged-in users (e.g. the cart). Pair with @Public() so the global guard
 * does not run first.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    // Swallow auth errors: return the user if resolved, otherwise undefined.
    return user || (undefined as TUser);
  }
}
