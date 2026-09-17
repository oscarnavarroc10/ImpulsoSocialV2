import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
  ApiForbiddenResponse,
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
  WalletBalanceDto,
  WalletCreditDto,
  WalletCreditReceiptDto,
  WalletMovementListDto,
  WalletMovementQueryDto,
} from '../application/dto/wallet.dto';
import { WalletService } from '../application/wallet.service';
import { WalletAuthenticationGuard } from '../security/wallet-authentication.guard';
import type { WalletRequest } from '../security/wallet-authentication.guard';

@ApiTags('Wallet')
@ApiBearerAuth()
@Controller('v1/wallet')
@UseGuards(WalletAuthenticationGuard)
export class WalletController {
  constructor(private readonly service: WalletService) {}

  @Get()
  @ApiOperation({ summary: "Get the authenticated customer's wallet" })
  @ApiOkResponse({ type: WalletBalanceDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  async getBalance(@Req() request: WalletRequest): Promise<WalletBalanceDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.getBalance(request.principal);
  }

  @Get('movements')
  @ApiOperation({
    summary: "List the authenticated customer's wallet movements",
  })
  @ApiOkResponse({ type: WalletMovementListDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  async listMovements(
    @Query() query: WalletMovementQueryDto,
    @Req() request: WalletRequest,
  ): Promise<WalletMovementListDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.listMovements(query, request.principal);
  }
}

@ApiTags('Admin Wallet')
@ApiBearerAuth()
@Controller('v1/admin/wallet-credits')
@UseGuards(WalletAuthenticationGuard)
export class AdminWalletCreditController {
  constructor(private readonly service: WalletService) {}

  @Post()
  @ApiOperation({ summary: 'Credit an active customer wallet manually' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: WalletCreditReceiptDto })
  @ApiOkResponse({ type: WalletCreditReceiptDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  @ApiResponse({
    status: 422,
    description: 'Wallet balance exceeds integer bounds',
  })
  async credit(
    @Body() dto: WalletCreditDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: WalletRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!key) throw new BadRequestException('Idempotency-Key is required');
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    const result = await this.service.credit(dto, key, request.principal);
    response.status(result.statusCode).json(result.receipt);
  }
}
