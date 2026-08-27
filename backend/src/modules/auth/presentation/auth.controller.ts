import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthService } from '../application/auth.service';
import {
  AuthResponseDto,
  LoginDto,
  RefreshResponseDto,
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
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }
}

@ApiTags('Auth')
@Controller('v1/auth')
export class AuthSessionController {
  constructor(private readonly authService: AuthService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar los tokens de autenticación',
  })
  @ApiOkResponse({
    description: 'Tokens renovados correctamente',
    type: RefreshResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'refreshToken es requerido y debe ser una cadena no vacía',
  })
  @ApiUnauthorizedResponse({
    description: 'Sesión inválida',
  })
  refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar sesión',
  })
  @ApiNoContentResponse({
    description: 'Sesión cerrada correctamente (idempotente)',
  })
  @ApiBadRequestResponse({
    description: 'refreshToken es requerido y debe ser una cadena no vacía',
  })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto);
  }
}
