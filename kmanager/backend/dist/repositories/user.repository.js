"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.PostgresUserRepository = void 0;
const database_1 = require("@config/database");
const user_model_1 = require("@models/user.model");
/**
 * Repositorio de Usuarios conectado a PostgreSQL.
 */
class PostgresUserRepository {
    async findByUsername(username) {
        const res = await database_1.pool.query('SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [username]);
        if (res.rows.length === 0)
            return undefined;
        const row = res.rows[0];
        return {
            id: String(row.id),
            username: row.username,
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role,
            googleId: row.googleId,
            avatarUrl: row.avatarUrl,
        };
    }
    async findById(id) {
        const res = await database_1.pool.query('SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE id = $1 LIMIT 1', [parseInt(id, 10)]);
        if (res.rows.length === 0)
            return undefined;
        const row = res.rows[0];
        return {
            id: String(row.id),
            username: row.username,
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role,
            googleId: row.googleId,
            avatarUrl: row.avatarUrl,
        };
    }
    async findByEmail(email) {
        const res = await database_1.pool.query('SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
        if (res.rows.length === 0)
            return undefined;
        const row = res.rows[0];
        return {
            id: String(row.id),
            username: row.username,
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role,
            googleId: row.googleId,
            avatarUrl: row.avatarUrl,
        };
    }
    async findByGoogleId(googleId) {
        const res = await database_1.pool.query('SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE google_id = $1 LIMIT 1', [googleId]);
        if (res.rows.length === 0)
            return undefined;
        const row = res.rows[0];
        return {
            id: String(row.id),
            username: row.username,
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role,
            googleId: row.googleId,
            avatarUrl: row.avatarUrl,
        };
    }
    async createGoogleUser(data) {
        // Asegurar username único
        let candidateUsername = data.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!candidateUsername || candidateUsername.length < 3) {
            candidateUsername = data.email.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'usuario';
        }
        const existingUser = await this.findByUsername(candidateUsername);
        if (existingUser) {
            candidateUsername = `${candidateUsername}_${Math.floor(100 + Math.random() * 900)}`;
        }
        const res = await database_1.pool.query(`INSERT INTO users (username, email, role, google_id, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, google_id AS "googleId", avatar_url AS "avatarUrl"`, [candidateUsername, data.email, user_model_1.Role.USER, data.googleId, data.avatarUrl || null]);
        const row = res.rows[0];
        const newUserId = row.id;
        // Seed Meta de Ahorro por defecto para el nuevo usuario
        await database_1.pool.query(`INSERT INTO saving_goals (user_id, target_amount, current_amount, month_year)
       VALUES ($1, 6500.00, 0.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))`, [newUserId]);
        // Seed Accesos Rápidos iniciales
        const catRows = await database_1.pool.query('SELECT id, name, icon, color FROM categories WHERE type = $1', ['expense']);
        const expCatMap = {};
        catRows.rows.forEach((r) => {
            expCatMap[r.name.toLowerCase()] = { id: r.id, icon: r.icon, color: r.color };
        });
        const defaults = [
            { title: 'Hogar', key: 'hogar', icon: 'home', color: 'blue' },
            { title: 'Luz', key: 'luz', icon: 'bolt', color: 'yellow' },
            { title: 'Agua', key: 'agua', icon: 'water_drop', color: 'cyan' },
            { title: 'Internet', key: 'internet', icon: 'wifi', color: 'purple' },
            { title: 'Tarjetas', key: 'tarjetas', icon: 'credit_card', color: 'rose' },
        ];
        for (const def of defaults) {
            const c = expCatMap[def.key];
            await database_1.pool.query(`INSERT INTO quick_expenses (user_id, category_id, title, icon, color, default_amount)
         VALUES ($1, $2, $3, $4, $5, $6)`, [newUserId, c ? c.id : null, def.title, c ? c.icon : def.icon, c ? c.color : def.color, 0.00]);
        }
        return {
            id: String(row.id),
            username: row.username,
            email: row.email,
            role: row.role,
            googleId: row.googleId,
            avatarUrl: row.avatarUrl,
        };
    }
    async linkGoogleId(userId, googleId, avatarUrl) {
        const res = await database_1.pool.query(`UPDATE users
       SET google_id = $1,
           avatar_url = COALESCE(avatar_url, $2)
       WHERE id = $3
       RETURNING id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl"`, [googleId, avatarUrl || null, parseInt(userId, 10)]);
        const row = res.rows[0];
        return {
            id: String(row.id),
            username: row.username,
            email: row.email,
            passwordHash: row.passwordHash,
            role: row.role,
            googleId: row.googleId,
            avatarUrl: row.avatarUrl,
        };
    }
}
exports.PostgresUserRepository = PostgresUserRepository;
exports.userRepository = new PostgresUserRepository();
//# sourceMappingURL=user.repository.js.map