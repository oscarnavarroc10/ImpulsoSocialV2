import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from '../../../src/modules/auth/application/auth.service';
import { AuthController, AuthSessionController } from '../../../src/modules/auth/presentation/auth.controller';

describe('customer auth error contract', () => {
  it('keeps login and refresh errors as typed generic HTTP errors', async () => {
    const authService = {
      login: jest.fn().mockRejectedValue(new UnauthorizedException('generic auth failure')),
      refresh: jest.fn().mockRejectedValue(new UnauthorizedException('generic session failure')),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController, AuthSessionController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    const loginController = module.get(AuthController);
    const sessionController = module.get(AuthSessionController);

    await expect(loginController.login({ email: 'customer@example.com', password: 'password-1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(sessionController.refresh({ refreshToken: 'invalid-token' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('preserves conflict errors without exposing provider fields', async () => {
    const authService = {
      register: jest.fn().mockRejectedValue(new ConflictException('account conflict')),
    };
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    await expect(
      module.get(AuthController).register({
        nombre: 'Customer',
        email: 'customer@example.com',
        password: 'password-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
