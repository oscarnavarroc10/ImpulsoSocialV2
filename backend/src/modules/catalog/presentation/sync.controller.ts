import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SyncDto } from '../application/dto/sync.dto';
import { SyncService } from '../sync/sync.service';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';

@ApiBearerAuth()
@Controller('catalog/sync')
@UseGuards(CatalogAuthorizationGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  async runOnDemand(@Body() body: unknown) {
    const dto = SyncDto.validate(body);

    if (
      dto.providerOrigin &&
      !['bulkfollows', 'smmgen'].includes(dto.providerOrigin)
    ) {
      throw new BadRequestException('providerOrigin is not supported');
    }

    return this.syncService.runSync(
      'on-demand',
      dto.providerOrigin ?? 'bulkfollows',
    );
  }
}
