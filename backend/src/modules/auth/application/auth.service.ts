import { Injectable, NotImplementedException } from '@nestjs/common';

import { LoginDto, RefreshTokenDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  register(dto: RegisterDto): never {
    void dto;

    throw new NotImplementedException(
      'El registro de usuarios todavía no está implementado',
    );
  }

  login(dto: LoginDto): never {
    void dto;

    throw new NotImplementedException(
      'El inicio de sesión todavía no está implementado',
    );
  }

  refresh(dto: RefreshTokenDto): never {
    void dto;

    throw new NotImplementedException(
      'La renovación de sesión todavía no está implementada',
    );
  }

  logout(dto: RefreshTokenDto): never {
    void dto;

    throw new NotImplementedException(
      'El cierre de sesión todavía no está implementado',
    );
  }
}
