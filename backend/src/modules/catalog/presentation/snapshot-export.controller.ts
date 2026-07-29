import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CatalogAuthorizationGuard } from '../security/catalog-authorization.guard';
import { ExportService } from '../snapshot/export.service';

function parseSnapshotId(snapshotId: string): string {
  const normalized = snapshotId?.trim();
  if (!normalized) {
    throw new BadRequestException('snapshotId must be a non-empty string');
  }

  return normalized;
}

@Controller('catalog/snapshots')
@UseGuards(CatalogAuthorizationGuard)
export class SnapshotExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get(':snapshotId/export')
  async exportPublishedSnapshot(@Param('snapshotId') snapshotId: string) {
    return this.exportService.exportPublishedSnapshot(
      parseSnapshotId(snapshotId),
    );
  }
}