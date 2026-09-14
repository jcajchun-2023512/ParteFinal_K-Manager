import { pool } from '@config/database';
import { Role, User } from '@models/user.model';

export interface IUserRepository {
  findByUsername(username: string): Promise<User | undefined>;
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  findByGoogleId(googleId: string): Promise<User | undefined>;
  createGoogleUser(data: { username: string; email: string; googleId: string; avatarUrl?: string }): Promise<User>;
  linkGoogleId(userId: string, googleId: string, avatarUrl?: string): Promise<User>;
}

/**
 * Repositorio de Usuarios conectado a PostgreSQL.
 */
export class PostgresUserRepository implements IUserRepository {
  async findByUsername(username: string): Promise<User | undefined> {
    const res = await pool.query(
      'SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username]
    );

    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as Role,
      googleId: row.googleId,
      avatarUrl: row.avatarUrl,
    };
  }

  async findById(id: string): Promise<User | undefined> {
    const res = await pool.query(
      'SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE id = $1 LIMIT 1',
      [parseInt(id, 10)]
    );

    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as Role,
      googleId: row.googleId,
      avatarUrl: row.avatarUrl,
    };
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const res = await pool.query(
      'SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );

    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as Role,
      googleId: row.googleId,
      avatarUrl: row.avatarUrl,
    };
  }

  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const res = await pool.query(
      'SELECT id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl" FROM users WHERE google_id = $1 LIMIT 1',
      [googleId]
    );

    if (res.rows.length === 0) return undefined;
    const row = res.rows[0];
    return {
      id: String(row.id),
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as Role,
      googleId: row.googleId,
      avatarUrl: row.avatarUrl,
    };
  }

  async createGoogleUser(data: { username: string; email: string; googleId: string; avatarUrl?: string }): Promise<User> {
    // Asegurar username único
    let candidateUsername = data.username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!candidateUsername || candidateUsername.length < 3) {
      candidateUsername = data.email.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'usuario';
    }

    const existingUser = await this.findByUsername(candidateUsername);
    if (existingUser) {
      candidateUsername = `${candidateUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const res = await pool.query(
      `INSERT INTO users (username, email, role, google_id, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, email, role, google_id AS "googleId", avatar_url AS "avatarUrl"`,
      [candidateUsername, data.email, Role.USER, data.googleId, data.avatarUrl || null]
    );

    const row = res.rows[0];
    const newUserId = row.id;

    // Seed Meta de Ahorro por defecto para el nuevo usuario
    await pool.query(
      `INSERT INTO saving_goals (user_id, target_amount, current_amount, month_year)
       VALUES ($1, 6500.00, 0.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))`,
      [newUserId]
    );

    // Seed Accesos Rápidos iniciales
    const catRows = await pool.query('SELECT id, name, icon, color FROM categories WHERE type = $1', ['expense']);
    const expCatMap: Record<string, { id: number; icon: string; color: string }> = {};
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
      await pool.query(
        `INSERT INTO quick_expenses (user_id, category_id, title, icon, color, default_amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newUserId, c ? c.id : null, def.title, c ? c.icon : def.icon, c ? c.color : def.color, 0.00]
      );
    }

    return {
      id: String(row.id),
      username: row.username,
      email: row.email,
      role: row.role as Role,
      googleId: row.googleId,
      avatarUrl: row.avatarUrl,
    };
  }

  async linkGoogleId(userId: string, googleId: string, avatarUrl?: string): Promise<User> {
    const res = await pool.query(
      `UPDATE users
       SET google_id = $1,
           avatar_url = COALESCE(avatar_url, $2)
       WHERE id = $3
       RETURNING id, username, email, password_hash AS "passwordHash", role, google_id AS "googleId", avatar_url AS "avatarUrl"`,
      [googleId, avatarUrl || null, parseInt(userId, 10)]
    );

    const row = res.rows[0];
    return {
      id: String(row.id),
      username: row.username,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role as Role,
      googleId: row.googleId,
      avatarUrl: row.avatarUrl,
    };
  }
}

export const userRepository: IUserRepository = new PostgresUserRepository();
