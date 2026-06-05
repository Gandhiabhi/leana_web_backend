import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { WishlistService } from './wishlist.service';

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current user wishlist' })
  list(@CurrentUser('id') userId: string) {
    return this.wishlistService.list(userId);
  }

  @Post('toggle/:productId')
  @ResponseMessage('Wishlist updated')
  @ApiOperation({ summary: 'Toggle a product in the wishlist' })
  toggle(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlistService.toggle(userId, productId);
  }

  @Post(':productId')
  @ResponseMessage('Added to wishlist')
  add(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlistService.add(userId, productId);
  }

  @Delete(':productId')
  @ResponseMessage('Removed from wishlist')
  remove(@CurrentUser('id') userId: string, @Param('productId') productId: string) {
    return this.wishlistService.remove(userId, productId);
  }
}
