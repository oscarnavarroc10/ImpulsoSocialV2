import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma/prisma.service';
import { DepositService } from './application/deposit.service';
import { DepositRepository } from './infrastructure/deposit.repository';
import {
  AdminDepositController,
  DepositController,
} from './presentation/deposit.controller';
import { DepositAuthenticationGuard } from './security/deposit-authentication.guard';

@Module({
  imports: [AuthModule],
  controllers: [DepositController, AdminDepositController],
  providers: [
    PrismaService,
    DepositService,
    DepositRepository,
    DepositAuthenticationGuard,
  ],
})
export class DepositsModule {}
