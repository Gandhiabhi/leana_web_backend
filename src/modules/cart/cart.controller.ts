import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { CartService, CartOwner } from './cart.service';
import { AddCartItemDto, MergeCartDto, UpdateCartItemDto } from './dto/cart.dto';

const SESSION_HEADER = 'x-cart-session';

@ApiTags('Cart')
@ApiHeader({ name: SESSION_HEADER, required: false, description: 'Guest cart session id' })
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private owner(user: AuthenticatedUser | undefined, sessionId?: string): CartOwner {
    return user ? { userId: user.id } : { sessionId };
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get the current cart (guest or authenticated)' })
  getCart(@CurrentUser() user: AuthenticatedUser | undefined, @Headers(SESSION_HEADER) sessionId?: string) {
    return this.cartService.getCart(this.owner(user, sessionId));
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post('items')
  @ResponseMessage('Item added to cart')
  @ApiOperation({ summary: 'Add an item to the cart' })
  addItem(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: AddCartItemDto,
    @Headers(SESSION_HEADER) sessionId?: string,
  ) {
    return this.cartService.addItem(this.owner(user, sessionId), dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update a cart item quantity' })
  updateItem(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers(SESSION_HEADER) sessionId?: string,
  ) {
    return this.cartService.updateItem(this.owner(user, sessionId), itemId, dto);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a cart item' })
  removeItem(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('itemId') itemId: string,
    @Headers(SESSION_HEADER) sessionId?: string,
  ) {
    return this.cartService.removeItem(this.owner(user, sessionId), itemId);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Delete()
  @ResponseMessage('Cart cleared')
  @ApiOperation({ summary: 'Clear the cart' })
  clear(@CurrentUser() user: AuthenticatedUser | undefined, @Headers(SESSION_HEADER) sessionId?: string) {
    return this.cartService.clear(this.owner(user, sessionId));
  }

  @Post('merge')
  @ApiBearerAuth()
  @ResponseMessage('Guest cart merged')
  @ApiOperation({ summary: 'Merge a guest cart into the authenticated user cart' })
  merge(@CurrentUser('id') userId: string, @Body() dto: MergeCartDto) {
    return this.cartService.merge(userId, dto.sessionId);
  }
}
