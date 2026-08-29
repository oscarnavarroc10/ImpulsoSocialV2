import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkFollowsOrderClient } from './infrastructure/bulkfollows-order.client';
import { OrderRepository } from './infrastructure/order.repository';
import { OrderService } from './application/order.service';
import { OrderController } from './presentation/order.controller';
import { OrderAuthenticationGuard } from './security/order-authentication.guard';

@Module({
  imports: [AuthModule],
  controllers: [OrderController],
  providers: [
    PrismaService,
    BulkFollowsOrderClient,
    OrderRepository,
    OrderService,
    OrderAuthenticationGuard,
  ],
})
export class OrdersModule {}
