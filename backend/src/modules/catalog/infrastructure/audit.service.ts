import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async recordImport(actorId: string, details?: Prisma.InputJsonValue | null) {
    return this.record(actorId, 'system', 'import', details);
  }

  async recordCuration(
    actorId: string,
    details?: Prisma.InputJsonValue | null,
  ) {
    return this.record(actorId, 'admin', 'curation', details);
  }

  async recordDeprecation(
    actorId: string,
    details?: Prisma.InputJsonValue | null,
  ) {
    return this.record(actorId, 'admin', 'deprecation', details);
  }

  async recordSnapshotPublication(
    actorId: string,
    details?: Prisma.InputJsonValue | null,
  ) {
    return this.record(actorId, 'admin', 'publish_snapshot', details);
  }

  async recordExport(actorId: string, details?: Prisma.InputJsonValue | null) {
    return this.record(actorId, 'admin', 'export', details);
  }

  private async record(
    actorId: string,
    actorType: string,
    action: string,
    details?: Prisma.InputJsonValue | null,
  ) {
    const payload: Prisma.InputJsonValue | undefined = details ?? undefined;
    return this.prisma.auditLog.create({
      data: { actorId, actorType, action, details: payload },
    });
  }
}
