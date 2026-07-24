import { Injectable } from '@nestjs/common';

export interface TenantVisibilityOverride {
  tenantId: string;
  masterServiceId: string;
  isEnabled: boolean;
}

export interface VisibilityResolutionInput {
  masterServiceId: string;
  masterIsVisible: boolean;
  override?: TenantVisibilityOverride | null;
}

export interface VisibilityResolutionResult {
  masterServiceId: string;
  isVisibleForTenant: boolean;
  source: 'master' | 'tenant_override';
}

@Injectable()
export class VisibilityResolutionService {
  resolve(input: VisibilityResolutionInput): VisibilityResolutionResult {
    const { masterServiceId, masterIsVisible, override } = input;

    if (!override) {
      return {
        masterServiceId,
        isVisibleForTenant: masterIsVisible,
        source: 'master',
      };
    }

    if (override.masterServiceId !== masterServiceId) {
      return {
        masterServiceId,
        isVisibleForTenant: masterIsVisible,
        source: 'master',
      };
    }

    if (!masterIsVisible) {
      return {
        masterServiceId,
        isVisibleForTenant: false,
        source: 'master',
      };
    }

    return {
      masterServiceId,
      isVisibleForTenant: override.isEnabled,
      source: 'tenant_override',
    };
  }
}