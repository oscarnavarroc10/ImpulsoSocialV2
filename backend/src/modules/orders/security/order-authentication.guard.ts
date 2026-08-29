import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthTokenService } from '../../auth/application/auth-token.service';
import { SesionRepository } from '../../auth/infrastructure/sesion.repository';
import { UsuarioRepository } from '../../auth/infrastructure/usuario.repository';
import { PrismaService } from '../../../prisma/prisma.service';

export interface OrderPrincipal {
  userId: string;
  tenantId: string;
  role: string;
}
export type OrderRequest = Request & { principal?: OrderPrincipal };

@Injectable()
export class OrderAuthenticationGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly sessions: SesionRepository,
    private readonly users: UsuarioRepository,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OrderRequest>();
    const header = request.headers.authorization;
    if (!header || !/^Bearer\s+\S+$/.test(header))
      throw new UnauthorizedException();
    try {
      const token = header.slice(header.indexOf(' ') + 1).trim();
      const payload = await this.tokens.verifyAccessToken(token);
      const session = await this.sessions.findById(payload.sid);
      if (
        !session ||
        session.usuarioId !== payload.sub ||
        session.revocadaEn ||
        session.expiraEn <= new Date()
      )
        throw new Error();
      const user = await this.users.findById(payload.sub);
      if (
        !user ||
        user.estado !== 'activo' ||
        user.tiendaId !== payload.tiendaId
      )
        throw new Error();
      const tenant = await this.prisma.tienda.findFirst({
        where: { id: user.tiendaId, activa: true },
        select: { id: true },
      });
      if (!tenant) throw new Error();
      request.principal = {
        userId: user.id,
        tenantId: user.tiendaId,
        role: user.rol,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
