"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
/**
 * Configuración centralizada leída de variables de entorno.
 * Mantener toda la lectura de process.env en un solo lugar facilita
 * testear y evita "magic strings" repartidos por el código.
 */
exports.env = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    },
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        name: process.env.DB_NAME || 'kmanager',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    },
};
//# sourceMappingURL=env.js.map