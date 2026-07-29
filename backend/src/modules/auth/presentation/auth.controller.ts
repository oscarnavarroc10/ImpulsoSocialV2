import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotImplementedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from '../application/auth.service';
import {
  AuthResponseDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
} from '../application/dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar un usuario',
  })
  @ApiCreatedResponse({
    description: 'Usuario registrado correctamente',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({
    description:
      'El correo electrónico ya está registrado o la tienda está inactiva',
  })
  @ApiInternalServerErrorResponse({
    description:
      'La tienda configurada para el registro no existe en la base de datos',
  })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
  })
  @ApiOkResponse({
    description: 'Inicio de sesión correcto',
  })
  @ApiNotImplementedResponse({
    description: 'Flujo pendiente de implementación',
  })
  login(@Body() dto: LoginDto): never {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar los tokens de autenticación',
  })
  @ApiOkResponse({
    description: 'Tokens renovados correctamente',
  })
  @ApiNotImplementedResponse({
    description: 'Flujo pendiente de implementación',
  })
  refresh(@Body() dto: RefreshTokenDto): never {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar sesión',
  })
  @ApiOkResponse({
    description: 'Sesión cerrada correctamente',
  })
  @ApiNotImplementedResponse({
    description: 'Flujo pendiente de implementación',
  })
  logout(@Body() dto: RefreshTokenDto): never {
    return this.authService.logout(dto);
  }
}
