import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'Oscar Navarro',
    description: 'Nombre completo del usuario',
    minLength: 3,
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 120)
  nombre: string;

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
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 100)
  password!: string;
}
