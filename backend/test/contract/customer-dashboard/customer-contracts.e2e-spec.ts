import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AuthController, AuthSessionController } from '../../../src/modules/auth/presentation/auth.controller';
import { PublicCatalogController } from '../../../src/modules/catalog/presentation/public-catalog.controller';
import { OrderController } from '../../../src/modules/orders/presentation/order.controller';
import { WalletController } from '../../../src/modules/wallets/presentation/wallet.controller';

describe('customer dashboard contract inventory', () => {
  it('keeps the verified customer endpoints registered', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AuthController)).toBe('auth');
    expect(Reflect.getMetadata(PATH_METADATA, AuthSessionController)).toBe('v1/auth');
    expect(Reflect.getMetadata(PATH_METADATA, PublicCatalogController)).toBe('v1/catalog/services');
    expect(Reflect.getMetadata(PATH_METADATA, OrderController)).toBe('v1/orders');
    expect(Reflect.getMetadata(PATH_METADATA, WalletController)).toBe('v1/wallet');
  });

  it('keeps authenticated read methods as GET handlers', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, OrderController.prototype.list)).toBe(0);
    expect(Reflect.getMetadata(METHOD_METADATA, OrderController.prototype.getById)).toBe(0);
    expect(Reflect.getMetadata(METHOD_METADATA, WalletController.prototype.getBalance)).toBe(0);
    expect(Reflect.getMetadata(METHOD_METADATA, WalletController.prototype.listMovements)).toBe(0);
  });
});
