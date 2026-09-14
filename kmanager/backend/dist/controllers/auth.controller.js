"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("@services/auth.service");
class AuthController {
    async login(req, res) {
        const { username, password } = req.body ?? {};
        if (!username || !password) {
            return res.status(400).json({
                message: 'Los campos "username" y "password" son obligatorios',
            });
        }
        try {
            const result = await auth_service_1.authService.login(username, password);
            return res.status(200).json(result);
        }
        catch (error) {
            if (error instanceof auth_service_1.InvalidCredentialsError) {
                return res.status(401).json({ message: error.message });
            }
            console.error('[AuthController.login] Error inesperado:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
    async refresh(req, res) {
        const { refreshToken } = req.body ?? {};
        if (!refreshToken) {
            return res.status(400).json({
                message: 'El campo "refreshToken" es obligatorio',
            });
        }
        try {
            const result = await auth_service_1.authService.refreshToken(refreshToken);
            return res.status(200).json(result);
        }
        catch (error) {
            if (error instanceof auth_service_1.InvalidCredentialsError) {
                return res.status(401).json({ message: error.message });
            }
            console.error('[AuthController.refresh] Error inesperado:', error);
            return res.status(500).json({ message: 'Error al renovar la sesión' });
        }
    }
    async googleLogin(req, res) {
        const { credential } = req.body ?? {};
        if (!credential) {
            return res.status(400).json({
                message: 'El token de credenciales de Google es obligatorio',
            });
        }
        try {
            const result = await auth_service_1.authService.loginWithGoogle(credential);
            return res.status(200).json(result);
        }
        catch (error) {
            if (error instanceof auth_service_1.InvalidCredentialsError) {
                return res.status(401).json({ message: error.message });
            }
            console.error('[AuthController.googleLogin] Error inesperado:', error);
            return res.status(500).json({ message: 'Error durante la autenticación con Google' });
        }
    }
    /** Endpoint de conveniencia para que el frontend valide la sesión activa. */
    async me(req, res) {
        // req.user es inyectado por authMiddleware
        return res.status(200).json({ user: req.user });
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map