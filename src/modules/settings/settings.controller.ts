import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Public storefront settings (general + branding)' })
  getPublic() {
    return this.settingsService.getPublic();
  }

  @Get(':group')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get a settings group (general|branding|checkout)' })
  getGroup(@Param('group') group: string) {
    return this.settingsService.getGroup(group);
  }

  @Put(':group')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Settings saved')
  @ApiOperation({ summary: 'Update a settings group' })
  setGroup(@Param('group') group: string, @Body() value: Record<string, unknown>) {
    return this.settingsService.setGroup(group, value);
  }
}
