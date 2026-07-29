import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token entregado durante la autenticación',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
