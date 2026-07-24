import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DeprecationService } from '../application/deprecation.service';
import {
  CATALOG_AUTHORIZATION,
  CatalogAuthorization,
} from '../security/catalog-authorization.interface';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';

function parseMasterServiceId(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Request body must be an object');
  }

  const masterServiceId = (body as { masterServiceId?: unknown })
    .masterServiceId;
  if (typeof masterServiceId !== 'string' || masterServiceId.trim() === '') {
    throw new BadRequestException('masterServiceId must be a non-empty string');
  }

  return masterServiceId;
}

@Controller('catalog/deprecations')
@UseGuards(CatalogAuthorizationGuard)
export class DeprecationController {
  constructor(
    private readonly deprecationService: DeprecationService,
    @Inject(CATALOG_AUTHORIZATION)
    private readonly authorization: CatalogAuthorization | null,
  ) {}

  @Get()
  async listPending() {
    return this.deprecationService.listPendingReview();
  }

  @Post('confirm')
  async confirm(@Body() body: unknown) {
    const actorId = await this.getActorId();
    const masterServiceId = parseMasterServiceId(body);
    return this.deprecationService.confirmDeprecation(actorId, masterServiceId);
  }

  private async getActorId(): Promise<string> {
    if (!this.authorization) {
      throw new ForbiddenException('Authorization service not available');
    }

    const principal = await this.authorization.getPrincipal();
    if (!principal?.id) {
      throw new ForbiddenException('No authenticated principal');
    }

    return principal.id;
  }
}
