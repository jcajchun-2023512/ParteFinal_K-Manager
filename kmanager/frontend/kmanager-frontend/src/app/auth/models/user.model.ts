export enum Role {
  ADMIN = 'Admin',
  USER = 'User',
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}
