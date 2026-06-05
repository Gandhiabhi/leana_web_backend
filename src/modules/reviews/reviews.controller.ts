import {
  Body,
  Controller,
  Delete,
  Get,
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
import { AuthenticatedUser } from '../../common/interfaces/jwt-payload.interface';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, QueryReviewDto, UpdateReviewStatusDto } from './dto/review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get('product/:productId')
  @ApiOperation({ summary: 'List approved reviews for a product' })
  listForProduct(@Param('productId') productId: string, @Query() query: QueryReviewDto) {
    return this.reviewsService.listForProduct(productId, query);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  @ResponseMessage('Review submitted for moderation')
  @ApiOperation({ summary: 'Submit a product review' })
  create(@CurrentUser() user: AuthenticatedUser | undefined, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(user, dto);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'List reviews for moderation (admin)' })
  findAllAdmin(@Query() query: QueryReviewDto) {
    return this.reviewsService.findAllAdmin(query);
  }

  @Get('admin/metrics')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  metrics() {
    return this.reviewsService.metrics();
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Review status updated')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateReviewStatusDto) {
    return this.reviewsService.updateStatus(id, dto.status);
  }

  @Patch(':id/flag')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ResponseMessage('Review flagged')
  flag(@Param('id') id: string) {
    return this.reviewsService.flag(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Review deleted')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
