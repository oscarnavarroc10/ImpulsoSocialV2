export interface ProviderServicePayload {
  externalId: string;
  title?: string;
  description?: string;
  categoryId?: string;
  socialNetwork?: string;
  rawPayload?: any;
}

export const PROVIDER_CATALOG_CLIENT = 'PROVIDER_CATALOG_CLIENT_TOKEN';

export interface ProviderCatalogClient {
  // Fetch all services (or a page) from the provider. Implementations may support pagination.
  fetchServices?(opts?: {
    page?: number;
    pageSize?: number;
  }): Promise<ProviderServicePayload[]>;
}
