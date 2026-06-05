import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      const count = await tx.address.count({ where: { userId } });
      return tx.address.create({
        data: { ...dto, userId, isDefault: dto.isDefault ?? count === 0 },
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.ensureOwned(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.address.delete({ where: { id } });
    return { id, deleted: true };
  }

  async setDefault(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });
  }

  private async ensureOwned(userId: string, id: string): Promise<void> {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw new NotFoundException('Address not found');
  }
}
