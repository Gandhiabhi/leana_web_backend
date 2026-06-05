import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { IntegrationsService } from './integrations.service';
import { ConnectIntegrationDto, UpdateIntegrationDto } from './dto/integration.dto';

@ApiTags('Integrations')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List integrations (admin)' })
  list() {
    return this.integrationsService.list();
  }

  @Post(':key/connect')
  @ResponseMessage('Integration connected')
  connect(@Param('key') key: string, @Body() dto: ConnectIntegrationDto) {
    return this.integrationsService.connect(key, dto);
  }

  @Patch(':key')
  @ResponseMessage('Integration updated')
  setEnabled(@Param('key') key: string, @Body() dto: UpdateIntegrationDto) {
    return this.integrationsService.setEnabled(key, dto.enabled);
  }

  @Delete(':key')
  @ResponseMessage('Integration disconnected')
  disconnect(@Param('key') key: string) {
    return this.integrationsService.disconnect(key);
  }
}
