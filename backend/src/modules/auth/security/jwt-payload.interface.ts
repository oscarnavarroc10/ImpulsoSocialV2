export type JwtTokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  email: string;
  rol: string;
  tiendaId: string;
  tipo: JwtTokenType;
}
