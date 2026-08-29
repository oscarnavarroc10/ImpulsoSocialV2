import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateOrderDto, OrderResponseDto } from '../application/dto/order.dto';
import { OrderService } from '../application/order.service';
import { OrderAuthenticationGuard } from '../security/order-authentication.guard';
import type { OrderRequest } from '../security/order-authentication.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('v1/orders')
@UseGuards(OrderAuthenticationGuard)
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Post()
  @ApiOperation({ summary: 'Place one BulkFollows Default service order' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiResponse({ status: 202, type: OrderResponseDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiConflictResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async create(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: OrderRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!key) throw new BadRequestException('Idempotency-Key is required');
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    try {
      const result = await this.service.create(dto, request.principal, key);
      response.status(result.statusCode).json(result.order);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVALID_IDEMPOTENCY_KEY')
        throw new BadRequestException('Invalid Idempotency-Key');
      throw error;
    }
  }
}
