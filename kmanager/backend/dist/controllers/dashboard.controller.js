"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = exports.DashboardController = void 0;
const dashboard_service_1 = require("@services/dashboard.service");
class DashboardController {
    async getSummary(req, res) {
        try {
            const userId = parseInt(req.user?.sub || '0', 10);
            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            const summary = await dashboard_service_1.dashboardService.getDashboardSummary(userId);
            return res.status(200).json(summary);
        }
        catch (error) {
            console.error('[DashboardController.getSummary] Error:', error);
            return res.status(500).json({ message: error.message || 'Error al obtener resumen' });
        }
    }
    async getTransactions(req, res) {
        try {
            const userId = parseInt(req.user?.sub || '0', 10);
            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            const type = req.query.type;
            const month = req.query.month ? parseInt(req.query.month, 10) : undefined;
            const year = req.query.year ? parseInt(req.query.year, 10) : undefined;
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
            const transactions = await dashboard_service_1.dashboardService.getTransactions(userId, { type, month, year, limit });
            return res.status(200).json(transactions);
        }
        catch (error) {
            console.error('[DashboardController.getTransactions] Error:', error);
            return res.status(500).json({ message: 'Error al obtener transacciones' });
        }
    }
    async createTransaction(req, res) {
        try {
            const userId = parseInt(req.user?.sub || '0', 10);
            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            const { title, subtitle, amount, type, status, transactionDate, categoryId } = req.body || {};
            const newTransaction = await dashboard_service_1.dashboardService.createTransaction(userId, {
                title,
                subtitle,
                amount: parseFloat(amount),
                type,
                status,
                transactionDate,
                categoryId: categoryId ? parseInt(String(categoryId), 10) : undefined,
            });
            return res.status(201).json(newTransaction);
        }
        catch (error) {
            console.error('[DashboardController.createTransaction] Error:', error);
            return res.status(400).json({ message: error.message || 'Error al crear transacción' });
        }
    }
    async getCategories(req, res) {
        try {
            const categories = await dashboard_service_1.dashboardService.getCategories();
            return res.status(200).json(categories);
        }
        catch (error) {
            console.error('[DashboardController.getCategories] Error:', error);
            return res.status(500).json({ message: 'Error al obtener categorías' });
        }
    }
    async getQuickExpenses(req, res) {
        try {
            const userId = parseInt(req.user?.sub || '0', 10);
            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            const quickExpenses = await dashboard_service_1.dashboardService.getQuickExpenses(userId);
            return res.status(200).json(quickExpenses);
        }
        catch (error) {
            console.error('[DashboardController.getQuickExpenses] Error:', error);
            return res.status(500).json({ message: 'Error al obtener egresos rápidos' });
        }
    }
    async createQuickExpense(req, res) {
        try {
            const userId = parseInt(req.user?.sub || '0', 10);
            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            const { title, categoryId, icon, color, defaultAmount } = req.body || {};
            const newQuickExpense = await dashboard_service_1.dashboardService.createQuickExpense(userId, {
                title,
                categoryId: categoryId ? parseInt(String(categoryId), 10) : undefined,
                icon,
                color,
                defaultAmount: defaultAmount ? parseFloat(defaultAmount) : 0,
            });
            return res.status(201).json(newQuickExpense);
        }
        catch (error) {
            console.error('[DashboardController.createQuickExpense] Error:', error);
            return res.status(400).json({ message: error.message || 'Error al crear egreso rápido' });
        }
    }
    async updateTransaction(req, res) {
        try {
            const userId = parseInt(req.user?.sub || '0', 10);
            if (!userId) {
                return res.status(401).json({ message: 'Usuario no autenticado' });
            }
            const id = parseInt(String(req.params.id), 10);
            if (!id) {
                return res.status(400).json({ message: 'ID de transacción inválido' });
            }
            const { title, subtitle, amount, type, status, transactionDate, categoryId } = req.body || {};
            const dto = {};
            if (title !== undefined)
                dto['title'] = title;
            if (subtitle !== undefined)
                dto['subtitle'] = subtitle;
            if (amount !== undefined)
                dto['amount'] = parseFloat(amount);
            if (type !== undefined)
                dto['type'] = type;
            if (status !== undefined)
                dto['status'] = status;
            if (transactionDate !== undefined)
                dto['transactionDate'] = transactionDate;
            if ('categoryId' in (req.body || {})) {
                dto['categoryId'] = categoryId ? parseInt(String(categoryId), 10) : null;
            }
            const updated = await dashboard_service_1.dashboardService.updateTransaction(userId, id, dto);
            return res.status(200).json(updated);
        }
        catch (error) {
            console.error('[DashboardController.updateTransaction] Error:', error);
            return res.status(400).json({ message: error.message || 'Error al actualizar transacción' });
        }
    }
    async deleteTransaction(req, res) {
        try {
            const userId = parseInt(req.user?.sub || '0', 10);
            const id = parseInt(String(req.params.id), 10);
            const deleted = await dashboard_service_1.dashboardService.deleteTransaction(userId, id);
            if (!deleted) {
                return res.status(404).json({ message: 'Transacción no encontrada' });
            }
            return res.status(200).json({ message: 'Transacción eliminada exitosamente' });
        }
        catch (error) {
            console.error('[DashboardController.deleteTransaction] Error:', error);
            return res.status(500).json({ message: 'Error al eliminar transacción' });
        }
    }
}
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
//# sourceMappingURL=dashboard.controller.js.map