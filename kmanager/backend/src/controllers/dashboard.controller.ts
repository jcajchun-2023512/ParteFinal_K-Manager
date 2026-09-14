import { Response } from 'express';
import { AuthenticatedRequest } from '@middlewares/auth.middleware';
import { dashboardService } from '@services/dashboard.service';

export class DashboardController {
  async getSummary(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.user?.sub || '0', 10);
      if (!userId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const summary = await dashboardService.getDashboardSummary(userId);
      return res.status(200).json(summary);
    } catch (error: any) {
      console.error('[DashboardController.getSummary] Error:', error);
      return res.status(500).json({ message: error.message || 'Error al obtener resumen' });
    }
  }

  async getTransactions(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.user?.sub || '0', 10);
      if (!userId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const type = req.query.type as 'income' | 'expense' | undefined;
      const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const transactions = await dashboardService.getTransactions(userId, { type, month, year, limit });
      return res.status(200).json(transactions);
    } catch (error: any) {
      console.error('[DashboardController.getTransactions] Error:', error);
      return res.status(500).json({ message: 'Error al obtener transacciones' });
    }
  }

  async createTransaction(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.user?.sub || '0', 10);
      if (!userId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const { title, subtitle, amount, type, status, transactionDate, categoryId } = req.body || {};
      const newTransaction = await dashboardService.createTransaction(userId, {
        title,
        subtitle,
        amount: parseFloat(amount),
        type,
        status,
        transactionDate,
        categoryId: categoryId ? parseInt(String(categoryId), 10) : undefined,
      });

      return res.status(201).json(newTransaction);
    } catch (error: any) {
      console.error('[DashboardController.createTransaction] Error:', error);
      return res.status(400).json({ message: error.message || 'Error al crear transacción' });
    }
  }

  async getCategories(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const categories = await dashboardService.getCategories();
      return res.status(200).json(categories);
    } catch (error: any) {
      console.error('[DashboardController.getCategories] Error:', error);
      return res.status(500).json({ message: 'Error al obtener categorías' });
    }
  }

  async getQuickExpenses(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.user?.sub || '0', 10);
      if (!userId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const quickExpenses = await dashboardService.getQuickExpenses(userId);
      return res.status(200).json(quickExpenses);
    } catch (error: any) {
      console.error('[DashboardController.getQuickExpenses] Error:', error);
      return res.status(500).json({ message: 'Error al obtener egresos rápidos' });
    }
  }

  async createQuickExpense(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.user?.sub || '0', 10);
      if (!userId) {
        return res.status(401).json({ message: 'Usuario no autenticado' });
      }

      const { title, categoryId, icon, color, defaultAmount } = req.body || {};
      const newQuickExpense = await dashboardService.createQuickExpense(userId, {
        title,
        categoryId: categoryId ? parseInt(String(categoryId), 10) : undefined,
        icon,
        color,
        defaultAmount: defaultAmount ? parseFloat(defaultAmount) : 0,
      });

      return res.status(201).json(newQuickExpense);
    } catch (error: any) {
      console.error('[DashboardController.createQuickExpense] Error:', error);
      return res.status(400).json({ message: error.message || 'Error al crear egreso rápido' });
    }
  }

  async updateTransaction(req: AuthenticatedRequest, res: Response): Promise<Response> {
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

      const dto: Record<string, any> = {};
      if (title !== undefined)           dto['title']           = title;
      if (subtitle !== undefined)        dto['subtitle']        = subtitle;
      if (amount !== undefined)          dto['amount']          = parseFloat(amount);
      if (type !== undefined)            dto['type']            = type;
      if (status !== undefined)          dto['status']          = status;
      if (transactionDate !== undefined) dto['transactionDate'] = transactionDate;
      if ('categoryId' in (req.body || {})) {
        dto['categoryId'] = categoryId ? parseInt(String(categoryId), 10) : null;
      }

      const updated = await dashboardService.updateTransaction(userId, id, dto);
      return res.status(200).json(updated);
    } catch (error: any) {
      console.error('[DashboardController.updateTransaction] Error:', error);
      return res.status(400).json({ message: error.message || 'Error al actualizar transacción' });
    }
  }

  async deleteTransaction(req: AuthenticatedRequest, res: Response): Promise<Response> {
    try {
      const userId = parseInt(req.user?.sub || '0', 10);
      const id = parseInt(String(req.params.id), 10);

      const deleted = await dashboardService.deleteTransaction(userId, id);
      if (!deleted) {
        return res.status(404).json({ message: 'Transacción no encontrada' });
      }

      return res.status(200).json({ message: 'Transacción eliminada exitosamente' });
    } catch (error: any) {
      console.error('[DashboardController.deleteTransaction] Error:', error);
      return res.status(500).json({ message: 'Error al eliminar transacción' });
    }
  }
}

export const dashboardController = new DashboardController();
