import { ApiProperty } from '@nestjs/swagger';

import { AuthUserDto } from './auth-user.dto';

export class AuthResponseDto {
  @ApiProperty({
    type: AuthUserDto,
  })
  usuario!: AuthUserDto;

  @ApiProperty({
    description: 'JWT de corta duración para acceder a endpoints protegidos',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT de larga duración para renovar la sesión',
  })
  refreshToken!: string;
}
