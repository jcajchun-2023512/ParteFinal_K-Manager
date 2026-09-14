export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  color: string;
}
export interface QuickExpense {
  id: number;
  userId?: number;
  categoryId?: number;
  title: string;
  icon: string;
  color: string;
  defaultAmount: number;
}
export interface CreateQuickExpenseDto {
  title: string;
  categoryId?: number;
  icon?: string;
  color?: string;
  defaultAmount?: number;
}
export interface MonthlyHistoryItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  rawDate?: string;
  status: string;
  statusClass: string;
  amount: string;
  isPositive: boolean;
  icon: string;
  iconBg: string;
  categoryId?: number;
}

export interface TransactionItem {
  id: number;
  userId: number;
  categoryId?: number;
  title: string;
  subtitle?: string;
  amount: number;
  type: 'income' | 'expense';
  status: 'Completado' | 'Pendiente' | 'Cancelado';
  transactionDate: string;
  date?: string;
  rawDate?: string;
  createdAt?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}
export interface DashboardSummary {
  totalIngresos: string;
  totalEgresos: string;
  saldo?: string;
  balance?: number;
  ingresosTrend: string;
  porcentajeAhorro: number;
  ahorradoMes: string;
  quickExpenses: QuickExpense[];
  monthlyHistory: MonthlyHistoryItem[];
}
export interface CreateTransactionDto {
  title: string;
  subtitle?: string;
  amount: number;
  type: 'income' | 'expense';
  status?: 'Completado' | 'Pendiente' | 'Cancelado';
  transactionDate?: string;
  categoryId?: number;
}
export interface UpdateTransactionDto {
  title?: string;
  subtitle?: string;
  amount?: number;
  type?: 'income' | 'expense';
  status?: 'Completado' | 'Pendiente' | 'Cancelado';
  transactionDate?: string;
  categoryId?: number | null;
}