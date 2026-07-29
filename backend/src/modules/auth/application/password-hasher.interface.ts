export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface PasswordHasher {
  hash(password: string): Promise<string>;

  compare(password: string, passwordHash: string): Promise<boolean>;
}
