import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from './application/wallet.service';
import { WalletRepository } from './infrastructure/wallet.repository';
import {
  AdminWalletCreditController,
  WalletController,
} from './presentation/wallet.controller';
import { WalletAuthenticationGuard } from './security/wallet-authentication.guard';

@Module({
  imports: [AuthModule],
  controllers: [WalletController, AdminWalletCreditController],
  providers: [
    PrismaService,
    WalletService,
    WalletRepository,
    WalletAuthenticationGuard,
  ],
})
export class WalletsModule {}
