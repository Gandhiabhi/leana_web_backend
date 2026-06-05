import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PaginatedResult } from '../../common/interfaces/api-response.interface';
import { paginate } from '../../common/utils/pagination.util';
import { PublicUser, userPublicSelect } from './users.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Full record incl. passwordHash — for internal auth use only. */
  async findByEmailWithSecrets(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async findByIdWithSecrets(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async findPublicById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userPublicSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: Prisma.UserCreateInput): Promise<PublicUser> {
    return this.prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
      select: userPublicSelect,
    });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    await this.findPublicById(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: userPublicSelect,
    });
  }

  // ── Auth-support mutations ──

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { emailVerified: true } });
  }

  async registerSuccessfulLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  async registerFailedLogin(user: User, maxAttempts: number, lockMinutes: number): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= maxAttempts;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + lockMinutes * 60_000) : user.lockedUntil,
      },
    });
  }

  // ── Admin listing ──

  async findAllPaginated(query: PaginationQueryDto): Promise<PaginatedResult<PublicUser>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userPublicSelect,
        skip: query.skip,
        take: query.take,
        orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }
}
