import { Prisma } from '@prisma/client';

/** Fields safe to expose to clients (never includes passwordHash). */
export const userPublicSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  tier: true,
  loyaltyPoints: true,
  location: true,
  emailVerified: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;
