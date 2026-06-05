import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Public()
  @Post('validate')
  @ApiOperation({ summary: 'Validate a coupon against a subtotal' })
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto.code, dto.subtotal);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List coupons (admin)' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.couponsService.findAll(query);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Coupon created')
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Coupon updated')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Coupon deleted')
  remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
