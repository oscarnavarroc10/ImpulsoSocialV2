import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { EstadoOrden } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateOrderDto {
  @ApiProperty({ example: 'cms6ae2pk0000qvic8e8fl1g7' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ example: 'https://www.instagram.com/example/' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  target!: string;

  @ApiProperty({ example: 1000, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class OrderPriceDto {
  @ApiProperty({ example: 15000 })
  amount!: number;

  @ApiProperty({ example: 'MXN' })
  currency!: string;
}

export class OrderResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() serviceId!: string;
  @ApiProperty() target!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty({ type: OrderPriceDto }) totalPrice!: OrderPriceDto;
  @ApiProperty({ enum: EstadoOrden })
  status!: string;
  @ApiProperty() createdAt!: Date;
}

export class OrderListQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based).',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size.',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: EstadoOrden,
    description: 'Exact status filter.',
  })
  @IsOptional()
  @IsEnum(EstadoOrden)
  status?: EstadoOrden;
}

export class OrderPaginationDto {
  @ApiProperty({ example: 1 }) page!: number;
  @ApiProperty({ example: 20 }) limit!: number;
  @ApiProperty({ example: 1 }) total!: number;
  @ApiProperty({ example: 1 }) totalPages!: number;
}

export class OrderListResponseDto {
  @ApiProperty({ type: [OrderResponseDto] }) items!: OrderResponseDto[];
  @ApiProperty({ type: OrderPaginationDto }) pagination!: OrderPaginationDto;
}
