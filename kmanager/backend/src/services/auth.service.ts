import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { env } from '@config/env';
import { userRepository } from '@repositories/user.repository';
import { toSafeUser, SafeUser } from '@models/user.model';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@utils/jwt.util';

export class InvalidCredentialsError extends Error {
  constructor(message = 'Usuario o contraseña incorrectos') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export interface LoginResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private googleClient = new OAuth2Client(env.google.clientId);

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await userRepository.findByUsername(username);

    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const payload = { sub: user.id, username: user.username, role: user.role };

    return {
      user: toSafeUser(user),
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    };
  }

  async refreshToken(refreshTokenString: string): Promise<LoginResult> {
    if (!refreshTokenString) {
      throw new InvalidCredentialsError('Refresh token no proporcionado');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshTokenString);
    } catch {
      throw new InvalidCredentialsError('Refresh token inválido o expirado');
    }

    const user = await userRepository.findById(decoded.sub);
    if (!user) {
      throw new InvalidCredentialsError('El usuario ya no existe');
    }

    const payload = { sub: user.id, username: user.username, role: user.role };

    return {
      user: toSafeUser(user),
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    };
  }

  async loginWithGoogle(credential: string): Promise<LoginResult> {
    if (!credential) {
      throw new InvalidCredentialsError('Token de Google no proporcionado');
    }

    let googlePayload;
    try {
      // Si está configurado clientId, se valida la audiencia; si no, se verifica la firma y el payload
      const verifyOptions: any = { idToken: credential };
      if (env.google.clientId) {
        verifyOptions.audience = env.google.clientId;
      }
      const ticket = await this.googleClient.verifyIdToken(verifyOptions);
      googlePayload = ticket.getPayload();
    } catch (err: any) {
      console.error('[AuthService.loginWithGoogle] Error verificando token de Google:', err?.message || err);
      throw new InvalidCredentialsError('Token de autenticación de Google inválido');
    }

    if (!googlePayload || !googlePayload.email || !googlePayload.sub) {
      throw new InvalidCredentialsError('Información de cuenta Google incompleta');
    }

    const googleId = googlePayload.sub;
    const email = googlePayload.email.toLowerCase();
    const name = googlePayload.name || googlePayload.given_name || email.split('@')[0];
    const picture = googlePayload.picture;

    // 1. Buscar si ya existe por Google ID
    let user = await userRepository.findByGoogleId(googleId);

    // 2. Si no, buscar si existe por Email para vincular
    if (!user) {
      user = await userRepository.findByEmail(email);
      if (user) {
        user = await userRepository.linkGoogleId(user.id, googleId, picture);
      }
    }

    // 3. Si no existe, crear un nuevo usuario con cuenta Google
    if (!user) {
      user = await userRepository.createGoogleUser({
        username: name,
        email,
        googleId,
        avatarUrl: picture,
      });
    }

    const payload = { sub: user.id, username: user.username, role: user.role };

    return {
      user: toSafeUser(user),
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    };
  }
}

export const authService = new AuthService();
