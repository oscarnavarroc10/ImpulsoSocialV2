import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MasterServiceRepository } from '../infrastructure/master-service.repository';

@Injectable()
export class MasterServiceVisibilityService {
  constructor(
    private readonly masterServiceRepository: MasterServiceRepository,
  ) {}

  async getVisibility(masterServiceId: string) {
    const service = await this.masterServiceRepository.findById(masterServiceId);
    if (!service) {
      throw new NotFoundException('Master service not found');
    }

    return {
      masterServiceId: service.id,
      isVisible: service.isVisible,
      status: service.status,
    };
  }

  async updateVisibility(masterServiceId: string, isVisible: boolean) {
    if (typeof isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean');
    }

    const service = await this.masterServiceRepository.findById(masterServiceId);
    if (!service) {
      throw new NotFoundException('Master service not found');
    }

    const updated = await this.masterServiceRepository.updateCuratedFields(
      masterServiceId,
      { isVisible },
    );

    return {
      masterServiceId: updated.id,
      isVisible: updated.isVisible,
      status: updated.status,
    };
  }
}