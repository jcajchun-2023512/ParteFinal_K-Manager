"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDatabaseConfigured = exports.pool = void 0;
exports.initializeDatabase = initializeDatabase;
const pg_1 = require("pg");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("./env");
exports.pool = new pg_1.Pool({
    host: env_1.env.db.host,
    port: env_1.env.db.port,
    database: env_1.env.db.name,
    user: env_1.env.db.user,
    password: env_1.env.db.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
exports.isDatabaseConfigured = true;
async function ensureDatabaseExists() {
    const adminPool = new pg_1.Pool({
        host: env_1.env.db.host,
        port: env_1.env.db.port,
        database: 'postgres',
        user: env_1.env.db.user,
        password: env_1.env.db.password,
        connectionTimeoutMillis: 5000,
    });
    try {
        const client = await adminPool.connect();
        try {
            const dbCheck = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [env_1.env.db.name]);
            if (dbCheck.rows.length === 0) {
                console.log(`📦 La base de datos "${env_1.env.db.name}" no existe. Creándola automáticamente...`);
                await client.query(`CREATE DATABASE "${env_1.env.db.name}"`);
                console.log(`✅ Base de datos "${env_1.env.db.name}" creada exitosamente.`);
            }
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error('❌ Error al verificar/crear la base de datos:', error.message);
        throw error;
    }
    finally {
        await adminPool.end();
    }
}
/**
 * Inicializa las tablas de PostgreSQL y crea datos semilla si no existen.
 */
async function initializeDatabase() {
    await ensureDatabaseExists();
    const client = await exports.pool.connect();
    try {
        console.log('🔄 Conectando e inicializando esquema de PostgreSQL (kmanager)...');
        // 1. Tabla de Usuarios
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        role VARCHAR(20) NOT NULL DEFAULT 'User',
        google_id VARCHAR(100) UNIQUE,
        avatar_url VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // Migración retrocompatible para bases de datos existentes
        await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    `);
        // 2. Tabla de Categorías
        await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        type VARCHAR(20) NOT NULL,
        icon VARCHAR(50) DEFAULT 'category',
        color VARCHAR(50) DEFAULT 'emerald',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // 3. Tabla de Transacciones (Ingresos y Egresos)
        await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id INT REFERENCES categories(id) ON DELETE SET NULL,
        title VARCHAR(150) NOT NULL,
        subtitle VARCHAR(150),
        amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
        type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
        status VARCHAR(20) NOT NULL DEFAULT 'Completado' CHECK (status IN ('Completado', 'Pendiente', 'Cancelado')),
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // 4. Tabla de Metas de Ahorro
        await client.query(`
      CREATE TABLE IF NOT EXISTS saving_goals (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_amount NUMERIC(12, 2) NOT NULL DEFAULT 6500.00,
        current_amount NUMERIC(12, 2) NOT NULL DEFAULT 4250.00,
        month_year VARCHAR(7) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // 5. Tabla de Egresos Fijos / Accesos Rápidos
        await client.query(`
      CREATE TABLE IF NOT EXISTS quick_expenses (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id INT REFERENCES categories(id) ON DELETE SET NULL,
        title VARCHAR(100) NOT NULL,
        icon VARCHAR(50) DEFAULT 'shopping_bag',
        color VARCHAR(50) DEFAULT 'rose',
        default_amount NUMERIC(12, 2) DEFAULT 0.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
        // --- SEEDING CATEGORÍAS (SI NO EXISTEN) ---
        const categoriesCount = await client.query('SELECT COUNT(*) FROM categories');
        if (parseInt(categoriesCount.rows[0].count, 10) === 0) {
            console.log('🌱 Creando categorías base en PostgreSQL...');
            await client.query(`
        INSERT INTO categories (name, type, icon, color) VALUES
        ('Nómina', 'income', 'account_balance', 'emerald'),
        ('Consultoría', 'income', 'trending_up', 'emerald'),
        ('Inversiones', 'income', 'savings', 'emerald'),
        ('Freelance', 'income', 'computer', 'purple'),
        ('Otros Ingresos', 'income', 'payments', 'emerald'),
        ('Hogar', 'expense', 'home', 'blue'),
        ('Luz', 'expense', 'bolt', 'yellow'),
        ('Agua', 'expense', 'water_drop', 'cyan'),
        ('Internet', 'expense', 'wifi', 'purple'),
        ('Tarjetas', 'expense', 'credit_card', 'rose'),
        ('Supermercado', 'expense', 'shopping_cart', 'rose'),
        ('Alquiler', 'expense', 'home', 'blue'),
        ('Transporte', 'expense', 'directions_car', 'amber'),
        ('Alimentación', 'expense', 'restaurant', 'rose'),
        ('Salud', 'expense', 'local_hospital', 'rose'),
        ('Educación', 'expense', 'school', 'purple'),
        ('Entretenimiento', 'expense', 'movie', 'purple'),
        ('Otros Gastos', 'expense', 'receipt_long', 'rose');
      `);
        }
        // --- SEEDING USUARIOS (SI NO EXISTEN) ---
        const usersCount = await client.query('SELECT COUNT(*) FROM users');
        if (parseInt(usersCount.rows[0].count, 10) === 0) {
            console.log('🌱 Creando usuarios iniciales (Admin / User) en PostgreSQL...');
            const adminHash = bcryptjs_1.default.hashSync('Admin123!', 10);
            const userHash = bcryptjs_1.default.hashSync('User123!', 10);
            const adminRes = await client.query(`INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`, ['admin', 'admin@kmanager.com', adminHash, 'Admin']);
            const userRes = await client.query(`INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`, ['user', 'user@kmanager.com', userHash, 'User']);
            const adminId = adminRes.rows[0].id;
            const userId = userRes.rows[0].id;
            // Seed Transacciones de ejemplo con category_id
            console.log('🌱 Creando transacciones de ejemplo con category_id...');
            const catRows = await client.query('SELECT id, name FROM categories');
            const catMap = {};
            catRows.rows.forEach((r) => {
                catMap[r.name.toLowerCase()] = r.id;
            });
            const nominaId = catMap['nómina'] || null;
            const consultoriaId = catMap['consultoría'] || null;
            const superId = catMap['supermercado'] || null;
            const alquilerId = catMap['alquiler'] || null;
            await client.query(`
        INSERT INTO transactions (user_id, category_id, title, subtitle, amount, type, status, transaction_date) VALUES
        (${userId}, ${nominaId}, 'Nómina Mensual', 'Ingreso Principal', 4500.00, 'income', 'Completado', '2023-11-01'),
        (${userId}, ${consultoriaId}, 'Consultoría TI', 'Ingreso Extra', 20090.00, 'income', 'Completado', '2023-11-05'),
        (${userId}, ${superId}, 'Supermercado', 'Alimentación', 320.50, 'expense', 'Completado', '2023-10-28'),
        (${userId}, ${alquilerId}, 'Alquiler', 'Vivienda', 1200.00, 'expense', 'Pendiente', '2023-10-25'),
        (${adminId}, ${nominaId}, 'Nómina Mensual', 'Ingreso Principal', 4500.00, 'income', 'Completado', '2023-11-01'),
        (${adminId}, ${consultoriaId}, 'Consultoría TI', 'Ingreso Extra', 20090.00, 'income', 'Completado', '2023-11-05'),
        (${adminId}, ${superId}, 'Supermercado', 'Alimentación', 320.50, 'expense', 'Completado', '2023-10-28'),
        (${adminId}, ${alquilerId}, 'Alquiler', 'Vivienda', 1200.00, 'expense', 'Pendiente', '2023-10-25');
      `);
            // Seed Meta de Ahorro
            await client.query(`
        INSERT INTO saving_goals (user_id, target_amount, current_amount, month_year) VALUES
        (${userId}, 6538.46, 4250.00, '2023-11'),
        (${adminId}, 6538.46, 4250.00, '2023-11');
      `);
        }
        // --- SEEDING ACCESOS RÁPIDOS POR DEFECTO PARA USUARIOS QUE NO TENGAN ---
        const allUsers = await client.query('SELECT id FROM users');
        const catRows = await client.query('SELECT id, name, icon, color FROM categories WHERE type = $1', ['expense']);
        const expCatMap = {};
        catRows.rows.forEach((r) => {
            expCatMap[r.name.toLowerCase()] = { id: r.id, icon: r.icon, color: r.color };
        });
        for (const u of allUsers.rows) {
            const qCount = await client.query('SELECT COUNT(*) FROM quick_expenses WHERE user_id = $1', [u.id]);
            if (parseInt(qCount.rows[0].count, 10) === 0) {
                console.log(`🌱 Creando accesos rápidos iniciales para usuario ${u.id}...`);
                const defaults = [
                    { title: 'Hogar', key: 'hogar', icon: 'home', color: 'blue' },
                    { title: 'Luz', key: 'luz', icon: 'bolt', color: 'yellow' },
                    { title: 'Agua', key: 'agua', icon: 'water_drop', color: 'cyan' },
                    { title: 'Internet', key: 'internet', icon: 'wifi', color: 'purple' },
                    { title: 'Tarjetas', key: 'tarjetas', icon: 'credit_card', color: 'rose' },
                ];
                for (const def of defaults) {
                    const c = expCatMap[def.key];
                    await client.query(`INSERT INTO quick_expenses (user_id, category_id, title, icon, color, default_amount)
             VALUES ($1, $2, $3, $4, $5, $6)`, [u.id, c ? c.id : null, def.title, c ? c.icon : def.icon, c ? c.color : def.color, 0.00]);
                }
            }
        }
        // --- MIGRACIÓN / VINCULACIÓN AUTOMÁTICA DE category_id NULL EN TRANSACCIONES EXISTENTES ---
        await client.query(`
      UPDATE transactions t
      SET category_id = c.id
      FROM categories c
      WHERE t.category_id IS NULL
        AND (
          LOWER(t.title) = LOWER(c.name)
          OR LOWER(t.subtitle) = LOWER(c.name)
          OR (LOWER(t.subtitle) LIKE '%' || LOWER(c.name) || '%')
          OR (LOWER(t.title) LIKE '%' || LOWER(c.name) || '%')
        );
    `);
        // Para cualquier transacción restante que aún sea NULL, asignar categoría por defecto de su tipo
        await client.query(`
      UPDATE transactions t
      SET category_id = (
        SELECT id FROM categories
        WHERE type = t.type
        ORDER BY id ASC LIMIT 1
      )
      WHERE t.category_id IS NULL;
    `);
        console.log('✅ PostgreSQL inicializado, esquema verificado y categorías vinculadas.');
    }
    catch (error) {
        console.error('❌ Error al conectar/inicializar PostgreSQL:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=database.js.map