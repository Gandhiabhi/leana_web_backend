import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/** Shape attached to `request.user` after a successful JWT validation. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}
