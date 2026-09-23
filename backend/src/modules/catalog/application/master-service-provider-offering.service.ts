import { Injectable } from '@nestjs/common';
import type {
  CreateOfferingInput,
  MasterServiceProviderOfferingRepository,
} from '../infrastructure/master-service-provider-offering.repository';

@Injectable()
export class MasterServiceProviderOfferingService {
  constructor(
    private readonly repository: MasterServiceProviderOfferingRepository,
  ) {}

  list(masterServiceId: string) {
    return this.repository.findForMasterService(masterServiceId);
  }

  create(input: CreateOfferingInput) {
    return this.repository.create(input);
  }

  select(masterServiceId: string, offeringId: string) {
    return this.repository.select(masterServiceId, offeringId);
  }
}