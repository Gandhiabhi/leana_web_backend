import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard overview (KPIs, recent orders, top products)' })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('analytics/revenue')
  @ApiOperation({ summary: 'Revenue grouped by month' })
  revenue(@Query('months') months?: string) {
    return this.adminService.revenueByMonth(months ? parseInt(months, 10) : 12);
  }

  @Get('analytics/top-products')
  @ApiOperation({ summary: 'Best-selling products by revenue' })
  topProducts(@Query('limit') limit?: string) {
    return this.adminService.topProducts(limit ? parseInt(limit, 10) : 10);
  }

  @Get('analytics/customers')
  @ApiOperation({ summary: 'Customer metrics (tiers, LTV, repeat rate)' })
  customerMetrics() {
    return this.adminService.customerMetrics();
  }

  @Get('customers')
  @ApiOperation({ summary: 'List customers' })
  async customers(@Query() query: PaginationQueryDto) {
    const { users, total } = await this.adminService.listCustomers(
      query.search,
      query.skip,
      query.take,
    );
    return {
      data: users,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page * query.limit < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }
}
