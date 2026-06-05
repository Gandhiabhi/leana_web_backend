import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { AddressesService } from './addresses.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@ApiTags('Addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user addresses' })
  list(@CurrentUser('id') userId: string) {
    return this.addressesService.list(userId);
  }

  @Post()
  @ResponseMessage('Address saved')
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(userId, dto);
  }

  @Patch(':id')
  @ResponseMessage('Address updated')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    return this.addressesService.update(userId, id, dto);
  }

  @Patch(':id/default')
  @ResponseMessage('Default address set')
  setDefault(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.addressesService.setDefault(userId, id);
  }

  @Delete(':id')
  @ResponseMessage('Address removed')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.addressesService.remove(userId, id);
  }
}
