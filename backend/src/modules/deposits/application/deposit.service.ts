import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EstadoDeposito, Prisma, TipoMovimientoSaldo } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  AdminDepositListQueryDto,
  AdminDepositListResponseDto,
  AdminDepositResponseDto,
  CreateDepositDto,
  DepositListQueryDto,
  DepositListResponseDto,
  DepositMethod,
  DepositResponseDto,
  RejectDepositDto,
} from './dto/deposit.dto';
import { DepositPrincipal } from '../security/deposit-authentication.guard';
import {
  AdminDepositFilters,
  DepositBalanceOverflowError,
  DepositDecisionRaceError,
  DepositFilters,
  DepositNotFoundError,
  DepositRecord,
  DepositRepository,
  DepositScope,
  DepositWalletRaceError,
} from '../infrastructure/deposit.repository';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_INT = 2147483647;
const MIN_INT = -2147483648;
const ADMIN_ROLES = new Set(['administradorTienda', 'administradorPlataforma']);

@Injectable()
export class DepositService {
  constructor(private readonly repository: DepositRepository) {}

  async create(
    dto: CreateDepositDto,
    key: string,
    principal: DepositPrincipal,
  ): Promise<{ deposit: DepositResponseDto; statusCode: 200 | 201 }> {
    const normalizedKey = this.normalizeKey(key);
    if (!Number.isInteger(dto.amount) || dto.amount < 1 || dto.amount > MAX_INT)
      throw new BadRequestException('Invalid deposit amount');
    const reference = this.normalizeReference(dto.paymentReference);
    const receiptUrl = this.normalizeReceipt(dto.receiptUrl);
    const provider = this.providerFor(dto.method);
    const currency = await this.repository.findTenantCurrency(
      principal.tenantId,
    );
    if (!currency) throw new NotFoundException('Deposit not found');
    const wallet = await this.repository.findCanonicalWallet(
      principal.tenantId,
      principal.userId,
      currency,
    );
    if (!wallet) throw new NotFoundException('Deposit not found');
    const keyHash = this.hash([
      principal.tenantId,
      principal.userId,
      normalizedKey,
    ]);
    const depositId = `deposit-request:${keyHash}`;
    const fingerprint = this.hash([
      dto.amount,
      dto.method,
      reference,
      receiptUrl,
    ]);
    const existing = await this.repository.findCreationClaim(
      depositId,
      principal.tenantId,
      principal.userId,
    );
    if (existing) return this.replayCreation(existing, fingerprint);
    if (
      await this.repository.findByEvidence(
        principal.tenantId,
        provider,
        reference,
      )
    )
      throw new ConflictException('Payment reference already submitted');
    try {
      const created = await this.repository.createPending({
        id: depositId,
        tenantId: principal.tenantId,
        userId: principal.userId,
        walletId: wallet.id,
        amount: dto.amount,
        currency,
        method: dto.method,
        provider,
        reference,
        receiptUrl,
        fingerprint,
      });
      return { deposit: this.toPublic(created), statusCode: 201 };
    } catch (error: unknown) {
      if (this.isPrismaError(error, 'P2002')) {
        const winner = await this.repository.findCreationClaim(
          depositId,
          principal.tenantId,
          principal.userId,
        );
        if (winner) return this.replayCreation(winner, fingerprint);
        const evidence = await this.repository.findByEvidence(
          principal.tenantId,
          provider,
          reference,
        );
        if (evidence)
          throw new ConflictException('Payment reference already submitted');
      }
      if (error instanceof DepositNotFoundError)
        throw new NotFoundException('Deposit not found');
      throw new InternalServerErrorException('Deposit creation failed');
    }
  }

  async list(
    query: DepositListQueryDto,
    principal: DepositPrincipal,
  ): Promise<DepositListResponseDto> {
    const scope = await this.scope(principal);
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filters: DepositFilters = {
      status: query.status,
      method: query.method,
    };
    const [items, total] = await Promise.all([
      this.repository.listOwn(scope, filters, (page - 1) * limit, limit),
      this.repository.countOwn(scope, filters),
    ]);
    return {
      items: items.map((item) => this.toPublic(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(
    id: string,
    principal: DepositPrincipal,
  ): Promise<DepositResponseDto> {
    const item = await this.repository.findOwnById(
      await this.scope(principal),
      id,
    );
    if (!item) throw new NotFoundException('Deposit not found');
    return this.toPublic(item);
  }

  async cancel(
    id: string,
    principal: DepositPrincipal,
  ): Promise<DepositResponseDto> {
    const scope = await this.scope(principal);
    let item = await this.repository.findOwnById(scope, id);
    if (!item) throw new NotFoundException('Deposit not found');
    if (item.status === EstadoDeposito.cancelado) return this.toPublic(item);
    if (item.status !== EstadoDeposito.pendiente)
      throw new ConflictException('Deposit state conflict');
    let changed: number;
    try {
      changed = await this.repository.cancelOwnPending(scope, id);
    } catch {
      throw new InternalServerErrorException('Deposit cancellation failed');
    }
    if (changed === 0) {
      item = await this.repository.findOwnById(scope, id);
      if (!item) throw new NotFoundException('Deposit not found');
      if (item.status === EstadoDeposito.cancelado) return this.toPublic(item);
      if (item.status !== EstadoDeposito.pendiente)
        throw new ConflictException('Deposit state conflict');
      throw new ConflictException('Deposit changed; retry');
    }
    item = await this.repository.findOwnById(scope, id);
    if (!item) throw new NotFoundException('Deposit not found');
    return this.toPublic(item);
  }

  async adminList(
    query: AdminDepositListQueryDto,
    principal: DepositPrincipal,
  ): Promise<AdminDepositListResponseDto> {
    this.requireAdmin(principal);
    const currency = await this.currency(principal.tenantId);
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const filters: AdminDepositFilters = {
      status: query.status,
      method: query.method,
      userId: query.userId,
    };
    const [items, total] = await Promise.all([
      this.repository.listAdmin(
        principal.tenantId,
        currency,
        filters,
        (page - 1) * limit,
        limit,
      ),
      this.repository.countAdmin(principal.tenantId, currency, filters),
    ]);
    return {
      items: items.map((item) => this.toAdmin(item)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async adminGetById(
    id: string,
    principal: DepositPrincipal,
  ): Promise<AdminDepositResponseDto> {
    this.requireAdmin(principal);
    const item = await this.repository.findAdminById(
      principal.tenantId,
      await this.currency(principal.tenantId),
      id,
    );
    if (!item) throw new NotFoundException('Deposit not found');
    return this.toAdmin(item);
  }

  async approve(
    id: string,
    principal: DepositPrincipal,
  ): Promise<DepositResponseDto> {
    this.requireAdmin(principal);
    const currency = await this.currency(principal.tenantId);
    const current = await this.repository.findAdminById(
      principal.tenantId,
      currency,
      id,
    );
    if (!current) throw new NotFoundException('Deposit not found');
    if (current.status === EstadoDeposito.aprobado)
      return this.approvedReplay(principal.tenantId, id, current);
    if (current.status !== EstadoDeposito.pendiente)
      throw new ConflictException('Deposit state conflict');
    try {
      const approved = await this.repository.approve({
        tenantId: principal.tenantId,
        depositId: id,
        adminId: principal.userId,
        currency,
      });
      return this.toPublic(approved);
    } catch (error: unknown) {
      if (error instanceof DepositBalanceOverflowError)
        throw new UnprocessableEntityException('Wallet balance overflow');
      if (
        error instanceof DepositWalletRaceError ||
        this.isPrismaError(error, 'P2034')
      )
        throw new ConflictException('Deposit changed; retry');
      if (error instanceof DepositNotFoundError)
        throw new NotFoundException('Deposit not found');
      if (error instanceof DepositDecisionRaceError) {
        const latest = await this.repository.findAdminById(
          principal.tenantId,
          currency,
          id,
        );
        if (!latest) throw new NotFoundException('Deposit not found');
        if (latest.status === EstadoDeposito.aprobado)
          return this.approvedReplay(principal.tenantId, id, latest);
        if (latest.status !== EstadoDeposito.pendiente)
          throw new ConflictException('Deposit state conflict');
        throw new ConflictException('Deposit changed; retry');
      }
      throw new InternalServerErrorException('Deposit approval failed');
    }
  }

  async reject(
    id: string,
    dto: RejectDepositDto,
    principal: DepositPrincipal,
  ): Promise<DepositResponseDto> {
    this.requireAdmin(principal);
    const reason = this.normalizeReason(dto.reason);
    const currency = await this.currency(principal.tenantId);
    let item = await this.repository.findAdminById(
      principal.tenantId,
      currency,
      id,
    );
    if (!item) throw new NotFoundException('Deposit not found');
    if (item.status === EstadoDeposito.rechazado) {
      if (item.rejectionReason === reason) return this.toPublic(item);
      throw new ConflictException('Deposit state conflict');
    }
    if (item.status !== EstadoDeposito.pendiente)
      throw new ConflictException('Deposit state conflict');
    let changed: number;
    try {
      changed = await this.repository.reject(
        principal.tenantId,
        currency,
        id,
        reason,
      );
    } catch {
      throw new InternalServerErrorException('Deposit rejection failed');
    }
    if (changed === 0) {
      item = await this.repository.findAdminById(
        principal.tenantId,
        currency,
        id,
      );
      if (!item) throw new NotFoundException('Deposit not found');
      if (
        item.status === EstadoDeposito.rechazado &&
        item.rejectionReason === reason
      )
        return this.toPublic(item);
      throw new ConflictException('Deposit state conflict');
    }
    item = await this.repository.findAdminById(
      principal.tenantId,
      currency,
      id,
    );
    if (!item) throw new NotFoundException('Deposit not found');
    return this.toPublic(item);
  }

  private async approvedReplay(
    tenantId: string,
    id: string,
    current: DepositRecord,
  ): Promise<DepositResponseDto> {
    const invariant = await this.repository.findApprovalInvariant(tenantId, id);
    if (
      !invariant ||
      invariant.deposit.status !== EstadoDeposito.aprobado ||
      invariant.deposit.id !== id ||
      invariant.deposit.tenantId !== tenantId ||
      invariant.deposit.walletId !== current.walletId ||
      invariant.deposit.amount !== current.amount ||
      !invariant.movement ||
      invariant.movement.id !== `deposit-credit:${id}` ||
      invariant.movement.walletId !== current.walletId ||
      invariant.movement.type !== TipoMovimientoSaldo.deposito ||
      invariant.movement.amount !== current.amount ||
      invariant.movement.reference !== id ||
      !Number.isInteger(invariant.movement.balanceAfter) ||
      invariant.movement.balanceAfter < MIN_INT ||
      invariant.movement.balanceAfter > MAX_INT
    )
      throw new InternalServerErrorException(
        'Deposit approval invariant failed',
      );
    return this.toPublic(current);
  }

  private async scope(principal: DepositPrincipal): Promise<DepositScope> {
    const currency = await this.currency(principal.tenantId);
    const wallet = await this.repository.findCanonicalWallet(
      principal.tenantId,
      principal.userId,
      currency,
    );
    if (!wallet) throw new NotFoundException('Deposit not found');
    return { tenantId: principal.tenantId, userId: principal.userId, currency };
  }

  private async currency(tenantId: string): Promise<string> {
    const currency = await this.repository.findTenantCurrency(tenantId);
    if (!currency) throw new NotFoundException('Deposit not found');
    return currency;
  }

  private requireAdmin(principal: DepositPrincipal): void {
    if (!ADMIN_ROLES.has(principal.role)) throw new ForbiddenException();
  }

  private replayCreation(
    item: DepositRecord,
    fingerprint: string,
  ): { deposit: DepositResponseDto; statusCode: 200 } {
    const data = item.providerData;
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      data.kind !== 'manual-deposit-request' ||
      data.requestFingerprint !== fingerprint
    )
      throw new ConflictException('Idempotency-Key conflict');
    return { deposit: this.toPublic(item), statusCode: 200 };
  }

  private normalizeKey(key: string): string {
    const normalized = typeof key === 'string' ? key.trim() : '';
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(normalized))
      throw new BadRequestException('Invalid Idempotency-Key');
    return normalized;
  }

  private normalizeReference(reference: string): string {
    const normalized = typeof reference === 'string' ? reference.trim() : '';
    if (normalized.length < 3 || normalized.length > 128)
      throw new BadRequestException('Invalid payment reference');
    return normalized;
  }

  private normalizeReceipt(receipt: string | undefined): string | null {
    if (receipt === undefined) return null;
    if (typeof receipt !== 'string')
      throw new BadRequestException('Invalid receipt URL');
    if (receipt.trim() === '') return null;
    const normalized = receipt.trim();
    try {
      const url = new URL(normalized);
      if (
        url.protocol !== 'https:' ||
        normalized.length > 2048 ||
        !/^https:\/\//i.test(normalized)
      )
        throw new Error();
    } catch {
      throw new BadRequestException('Invalid receipt URL');
    }
    return normalized;
  }

  private normalizeReason(reason: string): string {
    const normalized = typeof reason === 'string' ? reason.trim() : '';
    if (normalized.length < 3 || normalized.length > 500)
      throw new BadRequestException('Invalid rejection reason');
    return normalized;
  }

  private providerFor(method: DepositMethod): string {
    if (method === DepositMethod.transferencia) return 'manual-transfer';
    if (method === DepositMethod.criptomoneda) return 'manual-crypto';
    throw new BadRequestException('Invalid deposit method');
  }

  private hash(value: unknown[]): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private toPublic(item: DepositRecord): DepositResponseDto {
    return {
      id: item.id,
      amount: { amount: item.amount, currency: item.currency },
      method: item.method as unknown as DepositMethod,
      status: item.status,
      paymentReference: item.reference ?? '',
      receiptUrl: item.receiptUrl,
      rejectionReason: item.rejectionReason,
      approvedAt: item.approvedAt,
      rejectedAt: item.rejectedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private toAdmin(item: DepositRecord): AdminDepositResponseDto {
    return {
      ...this.toPublic(item),
      customer: item.customer ?? {
        id: item.userId,
        name: '',
        email: '',
      },
    };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      (error instanceof Prisma.PrismaClientKnownRequestError ||
        (typeof error === 'object' && error !== null && 'code' in error)) &&
      (error as { code?: unknown }).code === code
    );
  }
}
