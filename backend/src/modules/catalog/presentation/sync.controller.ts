import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SyncDto } from '../application/dto/sync.dto';
import { SyncService } from '../sync/sync.service';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';

@Controller('catalog/sync')
@UseGuards(CatalogAuthorizationGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post()
  async runOnDemand(@Body() body: unknown) {
    const dto = SyncDto.validate(body);

    if (dto.providerOrigin && dto.providerOrigin !== 'bulkfollows') {
      throw new BadRequestException(
        'providerOrigin must be "bulkfollows" for the current v1 integration',
      );
    }

    return this.syncService.runSync('on-demand');
  }
}
