import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurationService } from '../application/curation.service';
import { StagedCurationDto } from '../application/dto/staged-curation.dto';
import {
  CATALOG_AUTHORIZATION,
  CatalogAuthorization,
} from '../security/catalog-authorization.interface';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';

@Controller('catalog/staged-services')
@UseGuards(CatalogAuthorizationGuard)
export class StagedServiceController {
  constructor(
    private readonly curationService: CurationService,
    @Inject(CATALOG_AUTHORIZATION)
    private readonly authorization: CatalogAuthorization | null,
  ) {}

  @Get()
  async listPending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 100;
    return this.curationService.listPending(
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100,
    );
  }

  @Post('review')
  async review(@Body() body: unknown) {
    const actorId = await this.getActorId();
    const dto = StagedCurationDto.validate(body);
    return this.curationService.curate(actorId, dto);
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
