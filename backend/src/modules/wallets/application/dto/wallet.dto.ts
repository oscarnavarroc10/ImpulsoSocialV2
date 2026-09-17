import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { TipoMovimientoSaldo } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class WalletMoneyDto {
  @ApiProperty({ example: 100000 })
  amount!: number;

  @ApiProperty({ example: 'MXN' })
  currency!: string;
}

export class WalletBalanceDto {
  @ApiProperty({ type: WalletMoneyDto })
  balance!: WalletMoneyDto;
}

export class WalletMovementDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: TipoMovimientoSaldo }) type!: TipoMovimientoSaldo;
  @ApiProperty({ type: WalletMoneyDto }) amount!: WalletMoneyDto;
  @ApiProperty({ type: WalletMoneyDto }) balanceAfter!: WalletMoneyDto;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() createdAt!: Date;
}

export class WalletPaginationDto {
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}

export class WalletMovementListDto {
  @ApiProperty({ type: [WalletMovementDto] }) items!: WalletMovementDto[];
  @ApiProperty({ type: WalletPaginationDto }) pagination!: WalletPaginationDto;
}

export class WalletMovementQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: TipoMovimientoSaldo })
  @IsOptional()
  @IsEnum(TipoMovimientoSaldo)
  type?: TipoMovimientoSaldo;
}

export class WalletCreditDto {
  @ApiProperty({ example: 'user-id' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  userId!: string;

  @ApiProperty({ example: 50000, minimum: 1, maximum: 2147483647 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  amount!: number;
}

export class WalletCreditReceiptDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ type: WalletMoneyDto }) amount!: WalletMoneyDto;
  @ApiProperty({ type: WalletMoneyDto }) balanceAfter!: WalletMoneyDto;
  @ApiProperty() createdAt!: Date;
}
