import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { WalletService } from '../../../src/modules/wallets/application/wallet.service';
import { WalletRepository } from '../../../src/modules/wallets/infrastructure/wallet.repository';

describe('customer wallet error contract', () => {
  it('maps missing tenant or wallet data to a generic not-found error', async () => {
    const repository = {
      findTenantCurrency: jest.fn().mockResolvedValue('MXN'),
      findWallet: jest.fn().mockResolvedValue(null),
    };
    const module = await Test.createTestingModule({
      providers: [WalletService, { provide: WalletRepository, useValue: repository }],
    }).compile();

    await expect(
      module.get(WalletService).getBalance({
        tenantId: 'tenant-a',
        userId: 'user-a',
        role: 'cliente',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
