import { CatalogService, CustomerOrder, WalletBalance, WalletMovement } from './customer.models';

export const emptyCustomerResources = {
  catalog: [] as CatalogService[],
  orders: [] as CustomerOrder[],
  wallet: null as WalletBalance | null,
  movements: [] as WalletMovement[],
};