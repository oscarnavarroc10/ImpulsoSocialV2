import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../prisma/prisma.service';
import { BulkFollowsOrderClient } from './infrastructure/bulkfollows-order.client';
import { OrderRepository } from './infrastructure/order.repository';
import { OrderService } from './application/order.service';
import { OrderController } from './presentation/order.controller';
import { OrderAuthenticationGuard } from './security/order-authentication.guard';
import { CatalogModule } from '../catalog/catalog.module';
import { PROVIDER_ORDER_ADAPTER } from './application/provider-order-adapter';
import { BulkFollowsOrderAdapter } from './infrastructure/bulkfollows-order.adapter';
import { SmmgenOrderAdapter } from './infrastructure/smmgen-order.adapter';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [OrderController],
  providers: [
    PrismaService,
    BulkFollowsOrderClient,
    OrderRepository,
    OrderService,
    OrderAuthenticationGuard,
    BulkFollowsOrderAdapter,
    SmmgenOrderAdapter,
    {
      provide: PROVIDER_ORDER_ADAPTER,
      useFactory: (
        bulk: BulkFollowsOrderAdapter,
        smmgen: SmmgenOrderAdapter,
      ) => ({
        resolve: (origin: string) =>
          origin === 'smmgen' ? smmgen : origin === 'bulkfollows' ? bulk : null,
      }),
      inject: [BulkFollowsOrderAdapter, SmmgenOrderAdapter],
    },
  ],
})
export class OrdersModule {}
