import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurationService } from '../application/curation.service';
import { StagedCurationDto } from '../application/dto/staged-curation.dto';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';
import type { CatalogAuthenticatedRequest } from '../security/catalog-authorization.guard';

@Controller('catalog/staged-services')
@UseGuards(CatalogAuthorizationGuard)
export class StagedServiceController {
  constructor(private readonly curationService: CurationService) {}

  @Get()
  async listPending(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 100;
    return this.curationService.listPending(
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 100,
    );
  }

  @Post('review')
  async review(
    @Body() body: unknown,
    @Req() request: CatalogAuthenticatedRequest,
  ) {
    const actorId = this.getActorId(request);
    const dto = StagedCurationDto.validate(body);
    return this.curationService.curate(actorId, dto);
  }

  private getActorId(request: CatalogAuthenticatedRequest): string {
    if (!request.principal?.userId) {
      throw new UnauthorizedException('No authenticated principal');
    }

    return request.principal.userId;
  }
}
