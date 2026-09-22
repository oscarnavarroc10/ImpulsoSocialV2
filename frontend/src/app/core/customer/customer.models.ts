export type ResourceState = 'loading' | 'ready' | 'empty' | 'unavailable';

export type OrderSubmissionState = 'idle' | 'submitting' | 'pending' | 'ready' | 'unavailable';

export interface MoneyValue {
  amount: number;
  currency: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: Pagination;
}

export interface CatalogCategory {
  id: string;
  name: string;
  description: string | null;
}

export interface CatalogPlatformFacet {
  key: string;
  label: string;
  serviceCount: number;
}

export interface CatalogCategoryFacet extends CatalogCategory {
  platformKey: string;
  serviceCount: number;
}

export interface CatalogFacets {
  platforms: CatalogPlatformFacet[];
  categories: CatalogCategoryFacet[];
}

export interface CatalogResponse extends PaginatedResponse<CatalogService> {
  facets: CatalogFacets;
}

export interface CatalogService {
  id: string;
  title: string;
  description: string;
  socialNetwork: string;
  categoryId: string;
  category: CatalogCategory;
  sellingPrice: MoneyValue;
  minQuantity: number | null;
  maxQuantity: number | null;
  serviceMetadata?: {
    refill?: boolean;
    cancel?: boolean;
  };
}

export interface CustomerOrder {
  id: string;
  serviceId: string;
  target: string;
  quantity: number;
  totalPrice: MoneyValue;
  status: string;
  createdAt: string;
}

export interface WalletBalance {
  balance: MoneyValue;
}

export interface WalletMovement {
  id: string;
  type: string;
  amount: MoneyValue;
  balanceAfter: MoneyValue;
  description: string | null;
  createdAt: string;
}

export interface CustomerOrderResponse extends PaginatedResponse<CustomerOrder> {}

export interface WalletMovementResponse extends PaginatedResponse<WalletMovement> {}

export type OrderRequestResult =
  | { state: 'ready'; order: CustomerOrder; statusCode: 200 | 201 }
  | { state: 'pending'; order: CustomerOrder; statusCode: 202 }
  | { state: 'unavailable'; order: null; statusCode: number | null; error: CustomerError };

export type CustomerErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'network'
  | 'server'
  | 'unknown';

export interface CustomerError {
  code: CustomerErrorCode;
}

export function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  if (!isRecord(value) || !Array.isArray(value['items']) || !isRecord(value['pagination'])) {
    return false;
  }

  const pagination = value['pagination'];
  return ['page', 'limit', 'total', 'totalPages'].every((key) => Number.isInteger(pagination[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
