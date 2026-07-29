import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'oscar@example.com',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña del usuario',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
