export type JwtTokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  sid: string;
  email: string;
  rol: string;
  tiendaId: string;
  tipo: JwtTokenType;
}

export interface VerifiedJwtPayload extends JwtPayload {
  iat: number;
  exp: number;
}
