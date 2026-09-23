export interface ProviderServicePayload {
  providerOrigin?: string;
  externalId: string;
  title?: string;
  description?: string;
  categoryId?: string;
  socialNetwork?: string;
  rawPayload?: any;
}

export const PROVIDER_CATALOG_CLIENT = 'PROVIDER_CATALOG_CLIENT_TOKEN';

export interface ProviderCatalogClient {
  readonly providerOrigin?: string;
  fetchServicesSnapshot?(): Promise<ProviderCatalogSnapshot>;
  // Fetch all services (or a page) from the provider. Implementations may support pagination.
  fetchServices?(opts?: {
    page?: number;
    pageSize?: number;
  }): Promise<ProviderServicePayload[]>;
}

export interface ProviderCatalogSnapshot {
  complete: boolean;
  services: ProviderServicePayload[];
}

export interface ProviderCatalogClientResolver {
  resolve(providerOrigin: string): ProviderCatalogClient | null;
}
