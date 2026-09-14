export enum Role {
  ADMIN = 'Admin',
  USER = 'User',
}

/** Entidad completa tal como "vive" en la fuente de datos (incluye el hash). */
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash?: string;
  role: Role;
  googleId?: string;
  avatarUrl?: string;
}

/** Versión segura del usuario, sin el hash, lista para exponer al cliente. */
export type SafeUser = Omit<User, 'passwordHash'>;

export function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
