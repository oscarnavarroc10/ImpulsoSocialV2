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

export class PublicCatalogCategoryDto {
  @ApiProperty({ description: 'Current catalog category id.' })
  id!: string;

  @ApiProperty({ description: 'Current commercial category name.' })
  name!: string;

  @ApiProperty({ nullable: true, description: 'Current commercial category description.' })
  description!: string | null;
}

export class PublicCatalogServiceMetadataDto {
  @ApiProperty({ description: 'Whether the provider service supports refill.' })
  refill!: boolean;

  @ApiProperty({ description: 'Whether the provider service supports cancellation.' })
  cancel!: boolean;
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

  @ApiProperty({ type: () => PublicCatalogCategoryDto })
  category!: PublicCatalogCategoryDto;

  @ApiProperty({ type: PublicSellingPriceDto })
  sellingPrice!: PublicSellingPriceDto;

  @ApiProperty({
    nullable: true,
    description: 'Authoritative minimum quantity, or null when unavailable.',
    example: 100,
    type: Number,
  })
  minQuantity!: number | null;

  @ApiProperty({
    nullable: true,
    description: 'Authoritative maximum quantity, or null when unavailable.',
    example: 10000,
    type: Number,
  })
  maxQuantity!: number | null;

  @ApiPropertyOptional({ type: PublicCatalogServiceMetadataDto })
  serviceMetadata?: PublicCatalogServiceMetadataDto;
}

export class PublicCatalogPlatformFacetDto {
  @ApiProperty({ description: 'Stable platform key from the curated catalog.' })
  key!: string;

  @ApiProperty({ description: 'Customer-facing platform label.' })
  label!: string;

  @ApiProperty({ example: 12 })
  serviceCount!: number;
}

export class PublicCatalogCategoryFacetDto extends PublicCatalogCategoryDto {
  @ApiProperty({ description: 'Platform key associated with this category.' })
  platformKey!: string;

  @ApiProperty({ example: 4 })
  serviceCount!: number;
}

export class PublicCatalogFacetsDto {
  @ApiProperty({ type: [PublicCatalogPlatformFacetDto] })
  platforms!: PublicCatalogPlatformFacetDto[];

  @ApiProperty({ type: [PublicCatalogCategoryFacetDto] })
  categories!: PublicCatalogCategoryFacetDto[];
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

  @ApiProperty({ type: PublicCatalogFacetsDto })
  facets!: PublicCatalogFacetsDto;
}
