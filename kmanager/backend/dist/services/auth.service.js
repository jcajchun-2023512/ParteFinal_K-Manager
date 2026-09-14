"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = exports.InvalidCredentialsError = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const google_auth_library_1 = require("google-auth-library");
const env_1 = require("@config/env");
const user_repository_1 = require("@repositories/user.repository");
const user_model_1 = require("@models/user.model");
const jwt_util_1 = require("@utils/jwt.util");
class InvalidCredentialsError extends Error {
    constructor(message = 'Usuario o contraseña incorrectos') {
        super(message);
        this.name = 'InvalidCredentialsError';
    }
}
exports.InvalidCredentialsError = InvalidCredentialsError;
class AuthService {
    constructor() {
        this.googleClient = new google_auth_library_1.OAuth2Client(env_1.env.google.clientId);
    }
    async login(username, password) {
        const user = await user_repository_1.userRepository.findByUsername(username);
        if (!user || !user.passwordHash) {
            throw new InvalidCredentialsError();
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new InvalidCredentialsError();
        }
        const payload = { sub: user.id, username: user.username, role: user.role };
        return {
            user: (0, user_model_1.toSafeUser)(user),
            accessToken: (0, jwt_util_1.signAccessToken)(payload),
            refreshToken: (0, jwt_util_1.signRefreshToken)(payload),
        };
    }
    async refreshToken(refreshTokenString) {
        if (!refreshTokenString) {
            throw new InvalidCredentialsError('Refresh token no proporcionado');
        }
        let decoded;
        try {
            decoded = (0, jwt_util_1.verifyRefreshToken)(refreshTokenString);
        }
        catch {
            throw new InvalidCredentialsError('Refresh token inválido o expirado');
        }
        const user = await user_repository_1.userRepository.findById(decoded.sub);
        if (!user) {
            throw new InvalidCredentialsError('El usuario ya no existe');
        }
        const payload = { sub: user.id, username: user.username, role: user.role };
        return {
            user: (0, user_model_1.toSafeUser)(user),
            accessToken: (0, jwt_util_1.signAccessToken)(payload),
            refreshToken: (0, jwt_util_1.signRefreshToken)(payload),
        };
    }
    async loginWithGoogle(credential) {
        if (!credential) {
            throw new InvalidCredentialsError('Token de Google no proporcionado');
        }
        let googlePayload;
        try {
            // Si está configurado clientId, se valida la audiencia; si no, se verifica la firma y el payload
            const verifyOptions = { idToken: credential };
            if (env_1.env.google.clientId) {
                verifyOptions.audience = env_1.env.google.clientId;
            }
            const ticket = await this.googleClient.verifyIdToken(verifyOptions);
            googlePayload = ticket.getPayload();
        }
        catch (err) {
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
        let user = await user_repository_1.userRepository.findByGoogleId(googleId);
        // 2. Si no, buscar si existe por Email para vincular
        if (!user) {
            user = await user_repository_1.userRepository.findByEmail(email);
            if (user) {
                user = await user_repository_1.userRepository.linkGoogleId(user.id, googleId, picture);
            }
        }
        // 3. Si no existe, crear un nuevo usuario con cuenta Google
        if (!user) {
            user = await user_repository_1.userRepository.createGoogleUser({
                username: name,
                email,
                googleId,
                avatarUrl: picture,
            });
        }
        const payload = { sub: user.id, username: user.username, role: user.role };
        return {
            user: (0, user_model_1.toSafeUser)(user),
            accessToken: (0, jwt_util_1.signAccessToken)(payload),
            refreshToken: (0, jwt_util_1.signRefreshToken)(payload),
        };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map