import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
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
import {
  CreateOrderDto,
  OrderListQueryDto,
  OrderListResponseDto,
  OrderResponseDto,
} from '../application/dto/order.dto';
import { OrderService } from '../application/order.service';
import { OrderAuthenticationGuard } from '../security/order-authentication.guard';
import type { OrderRequest } from '../security/order-authentication.guard';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('v1/orders')
@UseGuards(OrderAuthenticationGuard)
export class OrderController {
  constructor(private readonly service: OrderService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated customer's orders" })
  @ApiOkResponse({ type: OrderListResponseDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  async list(
    @Query() query: OrderListQueryDto,
    @Req() request: OrderRequest,
  ): Promise<OrderListResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.list(query, request.principal);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get one of the authenticated customer's orders" })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  async getById(
    @Param('id') id: string,
    @Req() request: OrderRequest,
  ): Promise<OrderResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.getById(id, request.principal);
  }

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

  @Post(':id/refresh-status')
  @HttpCode(200)
  @ApiOperation({ summary: "Refresh one order's BulkFollows status" })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({ description: 'Order has no provider reference' })
  @ApiResponse({ status: 502, description: 'Provider status is unavailable' })
  @ApiResponse({ status: 503, description: 'Provider is not configured' })
  async refreshStatus(
    @Param('id') id: string,
    @Req() request: OrderRequest,
  ): Promise<OrderResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.refreshStatus(id, request.principal);
  }
}
