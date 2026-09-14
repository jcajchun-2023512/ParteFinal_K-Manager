"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionRepository = exports.PostgresTransactionRepository = void 0;
const database_1 = require("@config/database");
function formatDisplayDate(dateStr) {
    if (!dateStr)
        return '';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const monthIdx = parseInt(month, 10) - 1;
        return `${parseInt(day, 10)} ${months[monthIdx] || month}, ${year}`;
    }
    return String(dateStr);
}
class PostgresTransactionRepository {
    async findByUserId(userId, options) {
        let limit = 500;
        let type;
        let month;
        let year;
        if (typeof options === 'number') {
            limit = options;
        }
        else if (options) {
            if (options.limit)
                limit = options.limit;
            type = options.type;
            month = options.month;
            year = options.year;
        }
        const conditions = ['t.user_id = $1'];
        const params = [userId];
        let paramIdx = 2;
        if (type) {
            conditions.push(`t.type = $${paramIdx++}`);
            params.push(type);
        }
        if (month && month >= 1 && month <= 12) {
            conditions.push(`EXTRACT(MONTH FROM t.transaction_date) = $${paramIdx++}`);
            params.push(month);
        }
        if (year && year > 2000) {
            conditions.push(`EXTRACT(YEAR FROM t.transaction_date) = $${paramIdx++}`);
            params.push(year);
        }
        params.push(limit);
        const query = `
      SELECT t.id, t.user_id AS "userId", t.category_id AS "categoryId", t.title, t.subtitle,
             t.amount, t.type, t.status, TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS "rawTransactionDate",
             t.created_at AS "createdAt",
             c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor"
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY t.transaction_date DESC, t.id DESC
      LIMIT $${paramIdx}`;
        const res = await database_1.pool.query(query, params);
        return res.rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            categoryId: r.categoryId,
            title: r.title,
            subtitle: r.subtitle || (r.type === 'income' ? 'Ingreso' : 'Gasto'),
            amount: parseFloat(r.amount),
            type: r.type,
            status: r.status,
            transactionDate: formatDisplayDate(r.rawTransactionDate),
            rawDate: r.rawTransactionDate,
            createdAt: r.createdAt,
            categoryName: r.categoryName,
            categoryIcon: r.categoryIcon,
            categoryColor: r.categoryColor,
        }));
    }
    async findById(id, userId) {
        const query = `
      SELECT t.id, t.user_id AS "userId", t.category_id AS "categoryId", t.title, t.subtitle,
             t.amount, t.type, t.status, TO_CHAR(t.transaction_date, 'YYYY-MM-DD') AS "rawTransactionDate",
             t.created_at AS "createdAt",
             c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor"
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.id = $1 AND t.user_id = $2
      LIMIT 1`;
        const res = await database_1.pool.query(query, [id, userId]);
        if (res.rows.length === 0)
            return null;
        const r = res.rows[0];
        return {
            id: r.id,
            userId: r.userId,
            categoryId: r.categoryId,
            title: r.title,
            subtitle: r.subtitle || (r.type === 'income' ? 'Ingreso' : 'Gasto'),
            amount: parseFloat(r.amount),
            type: r.type,
            status: r.status,
            transactionDate: formatDisplayDate(r.rawTransactionDate),
            rawDate: r.rawTransactionDate,
            createdAt: r.createdAt,
            categoryName: r.categoryName,
            categoryIcon: r.categoryIcon,
            categoryColor: r.categoryColor,
        };
    }
    async getTotalsByUserId(userId) {
        const res = await database_1.pool.query(`SELECT
         COALESCE(SUM(CASE WHEN type = 'income' AND status != 'Cancelado' THEN amount ELSE 0 END), 0) AS "totalIncome",
         COALESCE(SUM(CASE WHEN type = 'expense' AND status != 'Cancelado' THEN amount ELSE 0 END), 0) AS "totalExpense"
       FROM transactions
       WHERE user_id = $1`, [userId]);
        const row = res.rows[0];
        const totalIncome = parseFloat(row.totalIncome);
        const totalExpense = parseFloat(row.totalExpense);
        return {
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
        };
    }
    async getSavingGoalByUserId(userId) {
        const res = await database_1.pool.query(`SELECT target_amount AS "targetAmount", current_amount AS "currentAmount"
       FROM saving_goals
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 1`, [userId]);
        if (res.rows.length === 0)
            return null;
        return {
            targetAmount: parseFloat(res.rows[0].targetAmount),
            currentAmount: parseFloat(res.rows[0].currentAmount),
        };
    }
    async create(userId, dto) {
        let resolvedCategoryId = dto.categoryId || null;
        // Si no se proporcionó categoryId explícitamente, intentar inferir por subtítulo o título
        if (!resolvedCategoryId) {
            const matchRes = await database_1.pool.query(`SELECT id FROM categories
         WHERE (
           LOWER(name) = LOWER($1)
           OR LOWER(name) = LOWER($2)
           OR $1 ILIKE '%' || name || '%'
           OR $2 ILIKE '%' || name || '%'
         )
         LIMIT 1`, [dto.subtitle || '', dto.title || '']);
            if (matchRes.rows.length > 0) {
                resolvedCategoryId = matchRes.rows[0].id;
            }
            else {
                // Fallback a la primera categoría disponible para ese tipo
                const fallbackRes = await database_1.pool.query(`SELECT id FROM categories WHERE type = $1 ORDER BY id ASC LIMIT 1`, [dto.type]);
                if (fallbackRes.rows.length > 0) {
                    resolvedCategoryId = fallbackRes.rows[0].id;
                }
            }
        }
        // Obtener fecha local en formato YYYY-MM-DD si no fue enviada
        let transactionDate = dto.transactionDate;
        if (!transactionDate || !transactionDate.trim()) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            transactionDate = `${y}-${m}-${d}`;
        }
        const res = await database_1.pool.query(`INSERT INTO transactions (user_id, category_id, title, subtitle, amount, type, status, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
       RETURNING id, user_id AS "userId", category_id AS "categoryId", title, subtitle,
                 amount, type, status, TO_CHAR(transaction_date, 'YYYY-MM-DD') AS "rawTransactionDate",
                 created_at AS "createdAt"`, [
            userId,
            resolvedCategoryId,
            dto.title,
            dto.subtitle || (dto.type === 'income' ? 'Ingreso General' : 'Gasto General'),
            dto.amount,
            dto.type,
            dto.status || 'Completado',
            transactionDate,
        ]);
        const r = res.rows[0];
        // Obtener datos de la categoría asignada
        let categoryName;
        let categoryIcon;
        let categoryColor;
        if (r.categoryId) {
            const catRes = await database_1.pool.query(`SELECT name, icon, color FROM categories WHERE id = $1`, [r.categoryId]);
            if (catRes.rows.length > 0) {
                categoryName = catRes.rows[0].name;
                categoryIcon = catRes.rows[0].icon;
                categoryColor = catRes.rows[0].color;
            }
        }
        return {
            id: r.id,
            userId: r.userId,
            categoryId: r.categoryId,
            title: r.title,
            subtitle: r.subtitle,
            amount: parseFloat(r.amount),
            type: r.type,
            status: r.status,
            transactionDate: formatDisplayDate(r.rawTransactionDate),
            createdAt: r.createdAt,
            categoryName,
            categoryIcon,
            categoryColor,
        };
    }
    async update(id, userId, dto) {
        // Construir SET dinámico con solo los campos enviados
        const setClauses = [];
        const values = [];
        let idx = 1;
        if (dto.title !== undefined) {
            setClauses.push(`title = $${idx++}`);
            values.push(dto.title);
        }
        if (dto.subtitle !== undefined) {
            setClauses.push(`subtitle = $${idx++}`);
            values.push(dto.subtitle);
        }
        if (dto.amount !== undefined) {
            setClauses.push(`amount = $${idx++}`);
            values.push(dto.amount);
        }
        if (dto.type !== undefined) {
            setClauses.push(`type = $${idx++}`);
            values.push(dto.type);
        }
        if (dto.status !== undefined) {
            setClauses.push(`status = $${idx++}`);
            values.push(dto.status);
        }
        if (dto.transactionDate !== undefined) {
            setClauses.push(`transaction_date = $${idx++}::date`);
            values.push(dto.transactionDate);
        }
        if ('categoryId' in dto) {
            setClauses.push(`category_id = $${idx++}`);
            values.push(dto.categoryId ?? null);
        }
        if (setClauses.length === 0)
            return null;
        values.push(id, userId);
        const res = await database_1.pool.query(`UPDATE transactions
       SET ${setClauses.join(', ')}
       WHERE id = $${idx} AND user_id = $${idx + 1}
       RETURNING id, user_id AS "userId", category_id AS "categoryId", title, subtitle,
                 amount, type, status, TO_CHAR(transaction_date, 'YYYY-MM-DD') AS "rawTransactionDate",
                 created_at AS "createdAt"`, values);
        if (res.rowCount === 0)
            return null;
        const r = res.rows[0];
        let categoryName;
        let categoryIcon;
        let categoryColor;
        if (r.categoryId) {
            const catRes = await database_1.pool.query(`SELECT name, icon, color FROM categories WHERE id = $1`, [r.categoryId]);
            if (catRes.rows.length > 0) {
                categoryName = catRes.rows[0].name;
                categoryIcon = catRes.rows[0].icon;
                categoryColor = catRes.rows[0].color;
            }
        }
        return {
            id: r.id,
            userId: r.userId,
            categoryId: r.categoryId,
            title: r.title,
            subtitle: r.subtitle,
            amount: parseFloat(r.amount),
            type: r.type,
            status: r.status,
            transactionDate: formatDisplayDate(r.rawTransactionDate),
            createdAt: r.createdAt,
            categoryName,
            categoryIcon,
            categoryColor,
        };
    }
    async delete(id, userId) {
        const res = await database_1.pool.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [id, userId]);
        return (res.rowCount ?? 0) > 0;
    }
    async getCategories() {
        const res = await database_1.pool.query(`SELECT id, name, type, icon, color, created_at AS "createdAt"
       FROM categories
       ORDER BY id ASC`);
        return res.rows.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            icon: r.icon,
            color: r.color,
            createdAt: r.createdAt,
        }));
    }
    async getQuickExpensesByUserId(userId) {
        const res = await database_1.pool.query(`SELECT q.id, q.user_id AS "userId", q.category_id AS "categoryId",
              q.title, q.icon, q.color, q.default_amount AS "defaultAmount",
              q.created_at AS "createdAt"
       FROM quick_expenses q
       WHERE q.user_id = $1
       ORDER BY q.id ASC`, [userId]);
        return res.rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            categoryId: r.categoryId,
            title: r.title,
            icon: r.icon,
            color: r.color,
            defaultAmount: parseFloat(r.defaultAmount || '0'),
            createdAt: r.createdAt,
        }));
    }
    async createQuickExpense(userId, dto) {
        const icon = dto.icon || 'shopping_bag';
        const color = dto.color || 'rose';
        const defaultAmount = dto.defaultAmount || 0.00;
        const res = await database_1.pool.query(`INSERT INTO quick_expenses (user_id, category_id, title, icon, color, default_amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id AS "userId", category_id AS "categoryId",
                 title, icon, color, default_amount AS "defaultAmount",
                 created_at AS "createdAt"`, [userId, dto.categoryId || null, dto.title, icon, color, defaultAmount]);
        const r = res.rows[0];
        return {
            id: r.id,
            userId: r.userId,
            categoryId: r.categoryId,
            title: r.title,
            icon: r.icon,
            color: r.color,
            defaultAmount: parseFloat(r.defaultAmount),
            createdAt: r.createdAt,
        };
    }
}
exports.PostgresTransactionRepository = PostgresTransactionRepository;
exports.transactionRepository = new PostgresTransactionRepository();
//# sourceMappingURL=transaction.repository.js.map