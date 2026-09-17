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
  AdminDepositListQueryDto,
  AdminDepositListResponseDto,
  AdminDepositResponseDto,
  CreateDepositDto,
  DepositListQueryDto,
  DepositListResponseDto,
  DepositResponseDto,
  RejectDepositDto,
} from '../application/dto/deposit.dto';
import { DepositService } from '../application/deposit.service';
import { DepositAuthenticationGuard } from '../security/deposit-authentication.guard';
import type { DepositRequest } from '../security/deposit-authentication.guard';

@ApiTags('Deposits')
@ApiBearerAuth()
@Controller('v1/deposits')
@UseGuards(DepositAuthenticationGuard)
export class DepositController {
  constructor(private readonly service: DepositService) {}

  @Post()
  @ApiOperation({ summary: 'Create a manual deposit request' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiCreatedResponse({ type: DepositResponseDto })
  @ApiOkResponse({ type: DepositResponseDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiResponse({ status: 500 })
  async create(
    @Body() dto: CreateDepositDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() request: DepositRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!key) throw new BadRequestException('Idempotency-Key is required');
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    const result = await this.service.create(dto, key, request.principal);
    response.status(result.statusCode).json(result.deposit);
  }

  @Get()
  @ApiOperation({ summary: "List the authenticated customer's deposits" })
  @ApiOkResponse({ type: DepositListResponseDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiResponse({ status: 500 })
  async list(
    @Query() query: DepositListQueryDto,
    @Req() request: DepositRequest,
  ): Promise<DepositListResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.list(query, request.principal);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get one of the authenticated customer's deposits" })
  @ApiOkResponse({ type: DepositResponseDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiResponse({ status: 500 })
  async getById(
    @Param('id') id: string,
    @Req() request: DepositRequest,
  ): Promise<DepositResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.getById(id, request.principal);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: "Cancel one of the authenticated customer's deposits",
  })
  @ApiOkResponse({ type: DepositResponseDto })
  @ApiUnauthorizedResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiResponse({ status: 500 })
  async cancel(
    @Param('id') id: string,
    @Req() request: DepositRequest,
  ): Promise<DepositResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.cancel(id, request.principal);
  }
}

@ApiTags('Admin Deposits')
@ApiBearerAuth()
@Controller('v1/admin/deposits')
@UseGuards(DepositAuthenticationGuard)
export class AdminDepositController {
  constructor(private readonly service: DepositService) {}

  @Get()
  @ApiOperation({ summary: 'List deposits for the current tenant' })
  @ApiOkResponse({ type: AdminDepositListResponseDto })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiResponse({ status: 500 })
  async list(
    @Query() query: AdminDepositListQueryDto,
    @Req() request: DepositRequest,
  ): Promise<AdminDepositListResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.adminList(query, request.principal);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one deposit for the current tenant' })
  @ApiOkResponse({ type: AdminDepositResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiResponse({ status: 500 })
  async getById(
    @Param('id') id: string,
    @Req() request: DepositRequest,
  ): Promise<AdminDepositResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.adminGetById(id, request.principal);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve a pending deposit' })
  @ApiOkResponse({ type: DepositResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  @ApiResponse({ status: 500 })
  async approve(
    @Param('id') id: string,
    @Req() request: DepositRequest,
  ): Promise<DepositResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.approve(id, request.principal);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a pending deposit' })
  @ApiOkResponse({ type: DepositResponseDto })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiBadRequestResponse()
  @ApiResponse({ status: 500 })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDepositDto,
    @Req() request: DepositRequest,
  ): Promise<DepositResponseDto> {
    if (!request.principal)
      throw new BadRequestException('Authentication principal missing');
    return this.service.reject(id, dto, request.principal);
  }
}
