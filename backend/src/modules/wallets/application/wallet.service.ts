import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma, TipoMovimientoSaldo } from '@prisma/client';
import {
  WalletCreditDto,
  WalletCreditReceiptDto,
  WalletBalanceDto,
  WalletMovementDto,
  WalletMovementListDto,
  WalletMovementQueryDto,
} from './dto/wallet.dto';
import { WalletPrincipal } from '../security/wallet-authentication.guard';
import {
  WalletBalanceOverflowError,
  WalletCreditRaceError,
  WalletNotFoundError,
  ManualCreditRecord,
  WalletRepository,
} from '../infrastructure/wallet.repository';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const ADMIN_ROLES = new Set(['administradorTienda', 'administradorPlataforma']);

@Injectable()
export class WalletService {
  constructor(private readonly repository: WalletRepository) {}

  async getBalance(principal: WalletPrincipal): Promise<WalletBalanceDto> {
    const scope = await this.scope(principal);
    const wallet = await this.repository.findWallet(scope);
    if (!wallet) throw new NotFoundException('Wallet not found');
    return { balance: { amount: wallet.balance, currency: wallet.currency } };
  }

  async listMovements(
    query: WalletMovementQueryDto,
    principal: WalletPrincipal,
  ): Promise<WalletMovementListDto> {
    const scope = await this.scope(principal);
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [items, total] = await Promise.all([
      this.repository.findMovements(
        scope,
        query.type,
        (page - 1) * limit,
        limit,
      ),
      this.repository.countMovements(scope, query.type),
    ]);
    if (!(await this.repository.findWallet(scope)))
      throw new NotFoundException('Wallet not found');
    return {
      items: items.map((item) => this.mapMovement(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async credit(
    dto: WalletCreditDto,
    key: string,
    principal: WalletPrincipal,
  ): Promise<{ receipt: WalletCreditReceiptDto; statusCode: 200 | 201 }> {
    if (!ADMIN_ROLES.has(principal.role)) throw new ForbiddenException();
    const normalizedKey = key.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(normalizedKey))
      throw new BadRequestException('Invalid Idempotency-Key');
    const targetUserId = dto.userId.trim();
    if (!targetUserId || !Number.isSafeInteger(dto.amount) || dto.amount < 1)
      throw new UnprocessableEntityException('Invalid wallet credit');
    const currency = await this.repository.findTenantCurrency(
      principal.tenantId,
    );
    if (!currency) throw new NotFoundException('Tenant not found');
    const keyHash = createHash('sha256')
      .update(JSON.stringify([principal.tenantId, normalizedKey]))
      .digest('hex');
    const movementId = `manual-credit:${keyHash}`;
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([targetUserId, dto.amount]))
      .digest('hex');
    const existing = await this.repository.findManualCredit(
      movementId,
      principal.tenantId,
    );
    if (existing) return this.replay(existing, fingerprint, 200);
    if (
      !(await this.repository.targetExists(
        principal.tenantId,
        targetUserId,
        currency,
      ))
    )
      throw new NotFoundException('Wallet not found');
    try {
      const created = await this.repository.createCredit({
        movementId,
        tenantId: principal.tenantId,
        userId: principal.userId,
        targetUserId,
        amount: dto.amount,
        currency,
        fingerprint,
        createdById: principal.userId,
      });
      return { receipt: this.mapReceipt(created), statusCode: 201 };
    } catch (error: unknown) {
      if (error instanceof WalletBalanceOverflowError)
        throw new UnprocessableEntityException('Wallet balance overflow');
      if (
        error instanceof WalletCreditRaceError ||
        this.isPrismaError(error, 'P2034')
      )
        throw new ConflictException('Wallet changed; retry with the same key');
      if (error instanceof WalletNotFoundError)
        throw new NotFoundException('Wallet not found');
      if (this.isPrismaError(error, 'P2002')) {
        const winner = await this.repository.findManualCredit(
          movementId,
          principal.tenantId,
        );
        if (winner) return this.replay(winner, fingerprint, 200);
      }
      throw new InternalServerErrorException('Wallet credit failed');
    }
  }

  private async scope(principal: WalletPrincipal) {
    const currency = await this.repository.findTenantCurrency(
      principal.tenantId,
    );
    if (!currency) throw new NotFoundException('Tenant not found');
    return { tenantId: principal.tenantId, userId: principal.userId, currency };
  }

  private replay(
    record: ManualCreditRecord,
    fingerprint: string,
    statusCode: 200,
  ): { receipt: WalletCreditReceiptDto; statusCode: 200 } {
    if (record.reference !== `manual-credit:${fingerprint}`)
      throw new ConflictException('Idempotency-Key conflict');
    return { receipt: this.mapReceipt(record), statusCode };
  }

  private mapMovement(item: {
    id: string;
    tipo: TipoMovimientoSaldo;
    monto: number;
    moneda: string;
    saldoPosterior: number;
    descripcion: string | null;
    creadoEn: Date;
  }): WalletMovementDto {
    return {
      id: item.id,
      type: item.tipo,
      amount: { amount: item.monto, currency: item.moneda },
      balanceAfter: { amount: item.saldoPosterior, currency: item.moneda },
      description: item.descripcion,
      createdAt: item.creadoEn,
    };
  }

  private mapReceipt(item: {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    balanceAfter: number;
    createdAt: Date;
  }): WalletCreditReceiptDto {
    return {
      id: item.id,
      userId: item.userId,
      amount: { amount: item.amount, currency: item.currency },
      balanceAfter: { amount: item.balanceAfter, currency: item.currency },
      createdAt: item.createdAt,
    };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }
}
