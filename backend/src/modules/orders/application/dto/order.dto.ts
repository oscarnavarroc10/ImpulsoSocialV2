import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Min,
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
  @ApiProperty({ enum: ['enviando', 'enviadaProveedor', 'reembolsada'] })
  status!: string;
  @ApiProperty() createdAt!: Date;
}
