import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SnapshotService } from './snapshot.service';

export interface ExportedSnapshotServiceItem {
  masterId: string;
  title: string;
  description: string;
  categories: Array<{
    id: string;
    name: string;
  }>;
  socialNetworks: string[];
  sellingPrice: {
    amount_minor: number;
    currency: string;
  };
  status: string;
}

export interface ExportedSnapshotDocument {
  contractVersion: string;
  services: ExportedSnapshotServiceItem[];
}

@Injectable()
export class ExportService {
  private readonly contractVersion = '1';

  constructor(private readonly snapshotService: SnapshotService) {}

  async exportPublishedSnapshot(snapshotId: string): Promise<ExportedSnapshotDocument> {
    this.ensureNonEmpty(snapshotId, 'snapshotId');

    const snapshot = await this.snapshotService.getById(snapshotId);
    if (!snapshot) {
      throw new NotFoundException('Snapshot not found');
    }

    if (snapshot.status !== 'published') {
      throw new BadRequestException('Only published snapshots can be exported');
    }

    return {
      contractVersion: this.contractVersion,
      services: snapshot.items.map((item) => ({
        masterId: item.masterServiceId,
        title: item.title,
        description: item.description,
        categories: [
          {
            id: item.categoryId,
            name: item.categoryName,
          },
        ],
        socialNetworks: [item.socialNetwork],
        sellingPrice: {
          amount_minor: item.sellingPriceAmount,
          currency: item.currency,
        },
        status: item.serviceStatus,
      })),
    };
  }

  private ensureNonEmpty(value: string, fieldName: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} must be a non-empty string`);
    }
  }
}