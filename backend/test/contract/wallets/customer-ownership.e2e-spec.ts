import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WalletService } from '../../../src/modules/wallets/application/wallet.service';
import { WalletRepository } from '../../../src/modules/wallets/infrastructure/wallet.repository';

describe('customer wallet ownership contract', () => {
  it('resolves balance and movements through the authenticated tenant/user scope', async () => {
    const repository = {
      findTenantCurrency: jest.fn().mockResolvedValue('MXN'),
      findWallet: jest.fn().mockResolvedValue(null),
      findMovements: jest.fn(),
      countMovements: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [WalletService, { provide: WalletRepository, useValue: repository }],
    }).compile();
    const service = module.get(WalletService);
    const principal = { tenantId: 'tenant-a', userId: 'user-a', role: 'cliente' as const };

    await expect(service.getBalance(principal)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findWallet).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      userId: 'user-a',
      currency: 'MXN',
    });
  });
});
