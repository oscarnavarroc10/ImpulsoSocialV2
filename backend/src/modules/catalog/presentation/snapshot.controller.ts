import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SnapshotDto } from '../application/dto/snapshot.dto';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';
import { SnapshotService } from '../snapshot/snapshot.service';

@Controller('catalog/snapshots')
@UseGuards(CatalogAuthorizationGuard)
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Post()
  async createAndPublish(@Body() body: unknown) {
    const dto = SnapshotDto.validate(body);

    const draftSnapshot = await this.snapshotService.createDraftSnapshot({
      createdBy: dto.createdBy,
      masterServiceIds: dto.itemIds,
    });

    if (!draftSnapshot?.id) {
      throw new BadRequestException('Snapshot creation failed');
    }

    return this.snapshotService.publishSnapshot(draftSnapshot.id);
  }
}