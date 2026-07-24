import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { MasterServiceVisibilityService } from '../application/master-service-visibility.service';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';

function parseMasterServiceId(id: string): string {
  const normalized = id?.trim();
  if (!normalized) {
    throw new BadRequestException('masterServiceId must be a non-empty string');
  }

  return normalized;
}

function parseIsVisible(body: unknown): boolean {
  if (!body || typeof body !== 'object') {
    throw new BadRequestException('Request body must be an object');
  }

  const isVisible = (body as { isVisible?: unknown }).isVisible;
  if (typeof isVisible !== 'boolean') {
    throw new BadRequestException('isVisible must be a boolean');
  }

  return isVisible;
}

@Controller('catalog/master-services')
@UseGuards(CatalogAuthorizationGuard)
export class MasterServiceVisibilityController {
  constructor(
    private readonly visibilityService: MasterServiceVisibilityService,
  ) {}

  @Get(':masterServiceId/visibility')
  async getVisibility(@Param('masterServiceId') masterServiceId: string) {
    return this.visibilityService.getVisibility(
      parseMasterServiceId(masterServiceId),
    );
  }

  @Patch(':masterServiceId/visibility')
  async updateVisibility(
    @Param('masterServiceId') masterServiceId: string,
    @Body() body: unknown,
  ) {
    return this.visibilityService.updateVisibility(
      parseMasterServiceId(masterServiceId),
      parseIsVisible(body),
    );
  }
}