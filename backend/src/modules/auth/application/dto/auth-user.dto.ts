import { ApiProperty } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({
    example: 'cm1234567890',
  })
  id!: string;

  @ApiProperty({
    example: 'Oscar Navarro',
  })
  nombre!: string;

  @ApiProperty({
    example: 'oscar@example.com',
  })
  email!: string;

  @ApiProperty({
    enum: RolUsuario,
    example: RolUsuario.cliente,
  })
  rol!: RolUsuario;

  @ApiProperty({
    example: 'cm0987654321',
  })
  tiendaId!: string;
}
