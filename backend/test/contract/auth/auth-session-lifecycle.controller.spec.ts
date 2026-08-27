import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';

import {
  AuthController,
  AuthSessionController,
} from '../../../src/modules/auth/presentation/auth.controller';
import { AuthService } from '../../../src/modules/auth/application/auth.service';

const FORBIDDEN_KEYS = [
  'refreshTokenHash',
  'passwordHash',
  'sid',
  'sub',
  'tipo',
  'secret',
  'usuarioId',
  'revocadaEn',
];

function assertNoForbiddenKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenKeys);
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      expect(FORBIDDEN_KEYS).not.toContain(key);
      assertNoForbiddenKeys(nested);
    }
  }
}

describe('Auth session lifecycle (contract)', () => {
  let app: INestApplication<App>;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, AuthSessionController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/auth/refresh', () => {
    it('works without an Authorization header and returns exactly two token fields', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const response = await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'submitted-token' })
        .expect(200);

      expect(Object.keys(response.body).sort()).toEqual(
        ['accessToken', 'refreshToken'].sort(),
      );
      assertNoForbiddenKeys(response.body);
    });

    it('maps an invalid refresh result to a generic HTTP 401', async () => {
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Sesión inválida'),
      );

      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'bad-token' })
        .expect(401);
    });

    it('rejects a missing refreshToken with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({})
        .expect(400);
    });

    it('rejects an empty refreshToken with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: '' })
        .expect(400);
    });

    it('rejects a non-string refreshToken with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/refresh')
        .send({ refreshToken: 12345 })
        .expect(400);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('returns HTTP 204 with an empty body without an Authorization header', async () => {
      authService.logout.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(204);

      expect(response.body).toEqual({});
      expect(response.text).toBe('');
    });

    it('rejects a missing refreshToken with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({})
        .expect(400);
    });

    it('rejects a non-string refreshToken with HTTP 400', async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/logout')
        .send({ refreshToken: {} })
        .expect(400);
    });
  });

  describe('legacy unversioned routes are removed', () => {
    it('POST /auth/refresh no longer exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'x' })
        .expect(404);
    });

    it('POST /auth/logout no longer exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'x' })
        .expect(404);
    });
  });

  describe('Swagger documentation', () => {
    it('documents the versioned refresh and logout contracts with no obsolete 501', () => {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Test').setVersion('1.0').build(),
      );

      const refreshPath = document.paths['/v1/auth/refresh'];
      const logoutPath = document.paths['/v1/auth/logout'];

      expect(refreshPath).toBeDefined();
      expect(logoutPath).toBeDefined();

      const refreshResponses = refreshPath.post!.responses;
      expect(Object.keys(refreshResponses)).toEqual(
        expect.arrayContaining(['200', '400', '401']),
      );
      expect(refreshResponses['501']).toBeUndefined();

      const logoutResponses = logoutPath.post!.responses;
      expect(Object.keys(logoutResponses)).toEqual(
        expect.arrayContaining(['204', '400']),
      );
      expect(logoutResponses['501']).toBeUndefined();
    });
  });
});
