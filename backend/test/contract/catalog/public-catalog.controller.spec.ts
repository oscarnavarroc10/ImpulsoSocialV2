import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';

import { PublicCatalogController } from '../../../src/modules/catalog/presentation/public-catalog.controller';
import { PublicCatalogService } from '../../../src/modules/catalog/application/public-catalog.service';

const FORBIDDEN_KEYS = [
  'providerCostAmount',
  'providerCostCurrency',
  'provenanceRef',
  'providerOrigin',
  'externalId',
  'rawPayload',
  'metadata',
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

describe('PublicCatalogController (contract)', () => {
  let app: INestApplication<App>;
  const publicCatalogService = {
    list: jest.fn(),
    getById: jest.fn(),
  };

  const sampleService = {
    id: 'master-1',
    title: 'Instagram Followers',
    description: 'Curated description',
    socialNetwork: 'Instagram',
    categoryId: 'cat-1',
    sellingPrice: { amount: 1750, currency: 'USD' },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PublicCatalogController],
      providers: [
        { provide: PublicCatalogService, useValue: publicCatalogService },
      ],
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

  it('serves the list route without any Authorization header', async () => {
    publicCatalogService.list.mockResolvedValue({
      items: [sampleService],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    await request(app.getHttpServer()).get('/v1/catalog/services').expect(200);

    expect(publicCatalogService.list).toHaveBeenCalled();
  });

  it('applies default pagination when none is provided', async () => {
    publicCatalogService.list.mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await request(app.getHttpServer()).get('/v1/catalog/services').expect(200);

    expect(publicCatalogService.list).toHaveBeenCalledWith(
      expect.objectContaining({}),
    );
  });

  it('accepts custom pagination and filters', async () => {
    publicCatalogService.list.mockResolvedValue({
      items: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });

    await request(app.getHttpServer())
      .get('/v1/catalog/services')
      .query({
        page: 2,
        limit: 5,
        socialNetwork: 'Instagram',
        categoryId: 'cat-1',
      })
      .expect(200);

    expect(publicCatalogService.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 5,
        socialNetwork: 'Instagram',
        categoryId: 'cat-1',
      }),
    );
  });

  it('rejects a non-positive page with 400', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalog/services')
      .query({ page: 0 })
      .expect(400);
  });

  it('rejects a limit above 100 with 400', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalog/services')
      .query({ limit: 101 })
      .expect(400);
  });

  it('rejects an empty filter value with 400', async () => {
    await request(app.getHttpServer())
      .get('/v1/catalog/services')
      .query({ socialNetwork: '   ' })
      .expect(400);
  });

  it('returns exactly the approved public fields with no forbidden keys', async () => {
    publicCatalogService.list.mockResolvedValue({
      items: [sampleService],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const response = await request(app.getHttpServer())
      .get('/v1/catalog/services')
      .expect(200);

    const body = response.body as {
      items: Record<string, unknown>[];
      pagination: Record<string, unknown>;
    };

    expect(Object.keys(body).sort()).toEqual(['items', 'pagination'].sort());
    expect(Object.keys(body.items[0]).sort()).toEqual(
      [
        'id',
        'title',
        'description',
        'socialNetwork',
        'categoryId',
        'sellingPrice',
      ].sort(),
    );
    expect(Object.keys(body.items[0].sellingPrice as object).sort()).toEqual([
      'amount',
      'currency',
    ]);
    assertNoForbiddenKeys(response.body);
  });

  it('documents success and error responses in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Test API').setVersion('1').build(),
    );

    expect(
      document.paths['/v1/catalog/services']?.get?.responses,
    ).toMatchObject({ '200': expect.any(Object), '400': expect.any(Object) });
    expect(
      document.paths['/v1/catalog/services/{id}']?.get?.responses,
    ).toMatchObject({
      '200': expect.any(Object),
      '400': expect.any(Object),
      '404': expect.any(Object),
    });
  });

  it('returns the public service for an eligible detail id', async () => {
    publicCatalogService.getById.mockResolvedValue(sampleService);

    const response = await request(app.getHttpServer())
      .get('/v1/catalog/services/master-1')
      .expect(200);

    expect(response.body).toEqual(sampleService);
    assertNoForbiddenKeys(response.body);
  });

  it('returns 404 when the service does not exist or is not visible', async () => {
    publicCatalogService.getById.mockRejectedValue(
      new NotFoundException('Service not found'),
    );

    await request(app.getHttpServer())
      .get('/v1/catalog/services/missing-id')
      .expect(404);
  });
});
