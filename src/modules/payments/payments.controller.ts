import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { RefundOrderDto } from '../orders/dto/order-admin.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing Stripe signature or body');
    }
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }

  @Post('orders/:orderId/refund')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ResponseMessage('Refund processed')
  @ApiOperation({ summary: 'Refund an order (admin)' })
  refund(@Param('orderId') orderId: string, @Body() dto: RefundOrderDto) {
    return this.paymentsService.refundOrder(orderId, dto.amount);
  }
}
