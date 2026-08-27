import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

function trimStringValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class PublicCatalogQueryDto {
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
    description: 'Exact social network filter.',
    example: 'Instagram',
  })
  @IsOptional()
  @Transform(trimStringValue)
  @IsString()
  @IsNotEmpty()
  socialNetwork?: string;

  @ApiPropertyOptional({
    description: 'Exact internal category id filter.',
    example: 'clv9z8y7x0002abcd1234efgh',
  })
  @IsOptional()
  @Transform(trimStringValue)
  @IsString()
  @IsNotEmpty()
  categoryId?: string;
}

export class PublicSellingPriceDto {
  @ApiProperty({ description: 'Amount in integer minor units.', example: 1750 })
  amount!: number;

  @ApiProperty({
    description: 'ISO currency code paired with amount.',
    example: 'USD',
  })
  currency!: string;
}

export class PublicCatalogServiceDto {
  @ApiProperty({
    description: 'Internal MasterService id.',
    example: 'clv1a2b3c0001abcd1234efgh',
  })
  id!: string;

  @ApiProperty({ example: 'Instagram Followers' })
  title!: string;

  @ApiProperty({ example: 'Curated customer description' })
  description!: string;

  @ApiProperty({ example: 'Instagram' })
  socialNetwork!: string;

  @ApiProperty({
    description: 'Internal category id.',
    example: 'clv9z8y7x0002abcd1234efgh',
  })
  categoryId!: string;

  @ApiProperty({ type: PublicSellingPriceDto })
  sellingPrice!: PublicSellingPriceDto;
}

export class PublicCatalogPaginationDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PublicCatalogListResponseDto {
  @ApiProperty({ type: [PublicCatalogServiceDto] })
  items!: PublicCatalogServiceDto[];

  @ApiProperty({ type: PublicCatalogPaginationDto })
  pagination!: PublicCatalogPaginationDto;
}
