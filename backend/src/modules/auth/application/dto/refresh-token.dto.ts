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

export class RefreshResponseDto {
  @ApiProperty({
    description: 'JWT de corta duración para acceder a endpoints protegidos',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT de larga duración para renovar la sesión',
  })
  refreshToken!: string;
}
