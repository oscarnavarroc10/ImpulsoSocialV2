import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { DeprecationService } from '../application/deprecation.service';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';
import type { CatalogAuthenticatedRequest } from '../security/catalog-authorization.guard';

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
  constructor(private readonly deprecationService: DeprecationService) {}

  @Get()
  async listPending() {
    return this.deprecationService.listPendingReview();
  }

  @Post('confirm')
  async confirm(
    @Body() body: unknown,
    @Req() request: CatalogAuthenticatedRequest,
  ) {
    const actorId = this.getActorId(request);
    const masterServiceId = parseMasterServiceId(body);
    return this.deprecationService.confirmDeprecation(actorId, masterServiceId);
  }

  private getActorId(request: CatalogAuthenticatedRequest): string {
    if (!request.principal?.userId) {
      throw new UnauthorizedException('No authenticated principal');
    }

    return request.principal.userId;
  }
}
