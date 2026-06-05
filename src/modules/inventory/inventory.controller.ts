import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { InventoryService } from './inventory.service';
import { AdjustStockDto, SetStockDto } from './dto/inventory.dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List products with stock levels' })
  list(@Query() query: PaginationQueryDto) {
    return this.inventoryService.list(query);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Products at or below their low-stock threshold' })
  lowStock() {
    return this.inventoryService.lowStock();
  }

  @Get('movements')
  @ApiOperation({ summary: 'Recent stock movements' })
  movements(@Query() query: PaginationQueryDto) {
    return this.inventoryService.movements(query);
  }

  @Post(':productId/adjust')
  @ResponseMessage('Stock adjusted')
  @ApiOperation({ summary: 'Adjust stock by a delta' })
  adjust(
    @Param('productId') productId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.inventoryService.adjust(productId, dto, actorId);
  }

  @Patch(':productId/set')
  @ResponseMessage('Stock updated')
  @ApiOperation({ summary: 'Set an absolute stock value' })
  setStock(
    @Param('productId') productId: string,
    @Body() dto: SetStockDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.inventoryService.setStock(productId, dto, actorId);
  }
}
