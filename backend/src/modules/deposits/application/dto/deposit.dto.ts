import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoDeposito } from '@prisma/client';

export enum DepositMethod {
  transferencia = 'transferencia',
  criptomoneda = 'criptomoneda',
}

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimReceipt = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
};

export class CreateDepositDto {
  @ApiProperty({ minimum: 1, maximum: 2147483647, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  amount!: number;

  @ApiProperty({ enum: DepositMethod })
  @IsEnum(DepositMethod)
  method!: DepositMethod;

  @ApiProperty({ minLength: 3, maxLength: 128 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(128)
  @IsNotEmpty()
  paymentReference!: string;

  @ApiPropertyOptional({
    maxLength: 2048,
    format: 'uri',
    example: 'https://example.com/receipt.jpg',
  })
  @Transform(trimReceipt)
  @IsOptional()
  @IsString()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  receiptUrl?: string;
}

export class DepositListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, type: Number })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, type: Number })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: EstadoDeposito })
  @IsOptional()
  @IsEnum(EstadoDeposito)
  status?: EstadoDeposito;

  @ApiPropertyOptional({ enum: DepositMethod })
  @IsOptional()
  @IsEnum(DepositMethod)
  method?: DepositMethod;
}

export class AdminDepositListQueryDto extends DepositListQueryDto {
  @ApiPropertyOptional({ maxLength: 128 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @IsNotEmpty()
  userId?: string;
}

export class RejectDepositDto {
  @ApiProperty({ minLength: 3, maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  @IsNotEmpty()
  reason!: string;
}

export class DepositMoneyDto {
  @ApiProperty({ type: Number })
  amount!: number;

  @ApiProperty()
  currency!: string;
}

export class DepositResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ type: DepositMoneyDto })
  amount!: DepositMoneyDto;

  @ApiProperty({ enum: DepositMethod })
  method!: DepositMethod;

  @ApiProperty({ enum: EstadoDeposito })
  status!: EstadoDeposito;

  @ApiProperty()
  paymentReference!: string;

  @ApiPropertyOptional({ nullable: true })
  receiptUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  rejectionReason!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  approvedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'date-time' })
  rejectedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class DepositCustomerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

export class AdminDepositResponseDto extends DepositResponseDto {
  @ApiProperty({ type: DepositCustomerDto })
  customer!: DepositCustomerDto;
}

export class DepositPaginationDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class DepositListResponseDto {
  @ApiProperty({ type: [DepositResponseDto] })
  items!: DepositResponseDto[];

  @ApiProperty({ type: DepositPaginationDto })
  pagination!: DepositPaginationDto;
}

export class AdminDepositListResponseDto {
  @ApiProperty({ type: [AdminDepositResponseDto] })
  items!: AdminDepositResponseDto[];

  @ApiProperty({ type: DepositPaginationDto })
  pagination!: DepositPaginationDto;
}
