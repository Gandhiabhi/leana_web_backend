import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrderDto, UpdateOrderStatusDto } from './dto/order-admin.dto';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('checkout')
  @ResponseMessage('Order created')
  @ApiOperation({ summary: 'Create an order from the cart and start payment' })
  checkout(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: CheckoutDto,
    @Headers('x-cart-session') sessionId?: string,
  ) {
    const owner = user ? { userId: user.id } : { sessionId: dto.sessionId ?? sessionId };
    return this.ordersService.checkout(owner, dto);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List the current user orders' })
  listMine(@CurrentUser('id') userId: string, @Query() query: PaginationQueryDto) {
    return this.ordersService.listForUser(userId, query);
  }

  @Get('admin/all')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List all orders (admin)' })
  findAllAdmin(@Query() query: QueryOrderDto) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get('admin/metrics')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Order KPIs (admin)' })
  metrics() {
    return this.ordersService.metrics();
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get an order by id (admin)' })
  getByIdAdmin(@Param('id') id: string) {
    return this.ordersService.getByIdAdmin(id);
  }

  @Patch('admin/:id/status')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Order status updated')
  @ApiOperation({ summary: 'Update order status (admin)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.ordersService.updateStatus(id, dto.status, dto.note, actorId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get one of the current user orders' })
  getMine(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.ordersService.getForUser(userId, id);
  }
}
