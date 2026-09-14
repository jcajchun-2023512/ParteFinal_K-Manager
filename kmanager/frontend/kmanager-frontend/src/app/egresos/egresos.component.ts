import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { Role } from '../auth/models/user.model';
import { DashboardService } from '../dashboard/services/dashboard.service';
import {
  Category,
  TransactionItem,
} from '../dashboard/models/dashboard.model';
import { DEFAULT_CATEGORIES, getTodayLocalDateString } from '../dashboard/dashboard.component';

export interface CategoryStat {
  id: number;
  name: string;
  amount: number;
  amountFormatted: string;
  percentage: number;
  icon: string;
  color: string;
}

export interface ExpenseChartBar {
  label: string;
  amount: number;
  amountFormatted: string;
  heightPercentage: number;
  isPeak: boolean;
}

@Component({
  selector: 'app-egresos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './egresos.component.html',
  styleUrl: './egresos.component.css',
})
export class EgresosComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private subscription = new Subscription();

  // State Signals
  readonly allExpenses = signal<TransactionItem[]>([]);
  readonly allIncomes = signal<TransactionItem[]>([]);
  readonly currentBalance = signal<number>(0);
  readonly saldoFormatted = signal<string>('Q0.00');
  readonly categories = signal<Category[]>(DEFAULT_CATEGORIES);
  readonly isLoading = signal<boolean>(true);
  readonly sessionExpired = signal<boolean>(false);
  readonly mobileMenuOpen = signal<boolean>(false);

  // Month & Year Filter Signals (Default to current month & current year)
  readonly selectedMonth = signal<number>(new Date().getMonth() + 1);
  readonly selectedYear = signal<number>(new Date().getFullYear());

  readonly monthsList = [
    { value: 1, name: 'Enero' },
    { value: 2, name: 'Febrero' },
    { value: 3, name: 'Marzo' },
    { value: 4, name: 'Abril' },
    { value: 5, name: 'Mayo' },
    { value: 6, name: 'Junio' },
    { value: 7, name: 'Julio' },
    { value: 8, name: 'Agosto' },
    { value: 9, name: 'Septiembre' },
    { value: 10, name: 'Octubre' },
    { value: 11, name: 'Noviembre' },
    { value: 12, name: 'Diciembre' },
  ];

  // Filtered Expenses by selected month & year
  readonly filteredExpenses = computed<TransactionItem[]>(() => {
    const list = this.allExpenses();
    const month = this.selectedMonth();
    const year = this.selectedYear();

    return list.filter((item) => {
      if (!item.rawDate) return true;
      const parts = item.rawDate.split('-');
      if (parts.length < 2) return true;
      const itemYear = parseInt(parts[0], 10);
      const itemMonth = parseInt(parts[1], 10);

      return itemYear === year && itemMonth === month;
    });
  });

  // Filtered Incomes by selected month & year for financial ratio calculation
  readonly selectedMonthIncome = computed<number>(() => {
    const list = this.allIncomes();
    const month = this.selectedMonth();
    const year = this.selectedYear();

    return list
      .filter((item) => {
        if (!item.rawDate || item.status === 'Cancelado') return false;
        const parts = item.rawDate.split('-');
        if (parts.length < 2) return false;
        const itemYear = parseInt(parts[0], 10);
        const itemMonth = parseInt(parts[1], 10);
        return itemYear === year && itemMonth === month;
      })
      .reduce((sum, item) => sum + item.amount, 0);
  });

  // Total Egresos for Selected Month
  readonly totalEgresosNumber = computed<number>(() => {
    return this.filteredExpenses().reduce((sum, item) => sum + item.amount, 0);
  });

  readonly totalEgresosFormatted = computed<string>(() => {
    return `Q${this.totalEgresosNumber().toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  });

  // Trend vs Previous Month Calculation
  readonly trendVsPreviousMonth = computed<{ percentage: string; isUp: boolean }>(() => {
    const month = this.selectedMonth();
    const year = this.selectedYear();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const prevMonthExpenses = this.allExpenses().filter((item) => {
      if (!item.rawDate) return false;
      const parts = item.rawDate.split('-');
      if (parts.length < 2) return false;
      return parseInt(parts[0], 10) === prevYear && parseInt(parts[1], 10) === prevMonth;
    });

    const prevTotal = prevMonthExpenses.reduce((sum, item) => sum + item.amount, 0);
    const currTotal = this.totalEgresosNumber();

    if (prevTotal === 0) {
      return { percentage: currTotal > 0 ? '+100%' : '0%', isUp: currTotal > 0 };
    }

    const diff = ((currTotal - prevTotal) / prevTotal) * 100;
    const sign = diff >= 0 ? '+' : '';
    return {
      percentage: `${sign}${diff.toFixed(1)}%`,
      isUp: diff >= 0,
    };
  });

  // Category Breakdown for Selected Month
  readonly categoryBreakdown = computed<CategoryStat[]>(() => {
    const expenses = this.filteredExpenses();
    const total = this.totalEgresosNumber();
    const catMap = new Map<number | string, { name: string; amount: number; icon: string; color: string }>();

    for (const exp of expenses) {
      const key = exp.categoryId || exp.categoryName || exp.title;
      const name = exp.categoryName || exp.subtitle || exp.title;
      const icon = exp.categoryIcon || 'shopping_cart';
      const color = exp.categoryColor || 'emerald';

      const existing = catMap.get(key);
      if (existing) {
        existing.amount += exp.amount;
      } else {
        catMap.set(key, { name, amount: exp.amount, icon, color });
      }
    }

    const stats: CategoryStat[] = [];
    let idCounter = 1;

    catMap.forEach((val) => {
      const pct = total > 0 ? Math.round((val.amount / total) * 100) : 0;
      stats.push({
        id: idCounter++,
        name: val.name,
        amount: val.amount,
        amountFormatted: `Q ${val.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        percentage: pct,
        icon: val.icon,
        color: val.color,
      });
    });

    // Sort by highest amount descending
    return stats.sort((a, b) => b.amount - a.amount);
  });

  // Dynamic Chart Bars calculated from real DB expense records for the selected month (by Day of Week)
  readonly chartBars = computed<ExpenseChartBar[]>(() => {
    const expenses = this.filteredExpenses();
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];

    for (const exp of expenses) {
      if (exp.rawDate && exp.status !== 'Cancelado') {
        const d = new Date(`${exp.rawDate}T12:00:00Z`);
        const dayIdx = d.getDay(); // 0 = Dom, 1 = Lun, etc.
        dayTotals[dayIdx] += exp.amount;
      }
    }

    // Reorder Lun..Dom for UI presentation
    const orderedIndices = [1, 2, 3, 4, 5, 6, 0];
    const maxDayAmount = Math.max(...dayTotals, 0);

    // Determinar presupuesto de referencia (Ingresos del mes o presupuesto base estándar)
    const monthIncome = this.selectedMonthIncome();
    const referenceCeiling = Math.max(
      monthIncome > 0 ? monthIncome : 10000,
      maxDayAmount > 0 ? maxDayAmount * 1.15 : 10000
    );

    let peakIdx = -1;
    let maxVal = -1;

    orderedIndices.forEach((dayIdx, i) => {
      if (dayTotals[dayIdx] > maxVal && dayTotals[dayIdx] > 0) {
        maxVal = dayTotals[dayIdx];
        peakIdx = i;
      }
    });

    return orderedIndices.map((dayIdx, i) => {
      const val = dayTotals[dayIdx];
      // Cálculo proporcional real: porcentaje sobre el presupuesto / ingreso de referencia
      let heightPercentage: number;
      if (val === 0) {
        heightPercentage = 8; // Línea base estética mínima
      } else {
        const ratio = referenceCeiling > 0 ? (val / referenceCeiling) * 100 : 0;
        heightPercentage = Math.min(100, Math.max(12, Math.round(ratio)));
      }

      return {
        label: dayNames[dayIdx],
        amount: val,
        amountFormatted: `Q${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        heightPercentage,
        isPeak: i === peakIdx && val > 0,
      };
    });
  });

  // Toast Alerts
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error' | 'info'>('info');

  // Modals UI
  readonly showNewOperationModal = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  readonly showEditModal = signal<boolean>(false);
  readonly editingItem = signal<TransactionItem | null>(null);
  readonly isEditSubmitting = signal<boolean>(false);

  readonly showDeleteConfirmModal = signal<boolean>(false);
  readonly deletingItem = signal<TransactionItem | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // New Operation Form Signals
  readonly opTitle = signal<string>('');
  readonly opAmount = signal<number | null>(null);
  readonly opSubtitle = signal<string>('');
  readonly opCategoryId = signal<number | null>(null);
  readonly opDate = signal<string>(getTodayLocalDateString());
  readonly opStatus = signal<'Completado' | 'Pendiente' | 'Cancelado'>('Completado');

  // Edit Form Signals
  readonly editId = signal<number | null>(null);
  readonly editTitle = signal<string>('');
  readonly editAmount = signal<number | null>(null);
  readonly editSubtitle = signal<string>('');
  readonly editCategoryId = signal<number | null>(null);
  readonly editDate = signal<string>(getTodayLocalDateString());
  readonly editStatus = signal<'Completado' | 'Pendiente' | 'Cancelado'>('Completado');

  ngOnInit(): void {
    this.authService.startExpirationCheck();
    this.subscription.add(
      this.authService.tokenExpired$.subscribe((expired) => {
        this.sessionExpired.set(expired);
      })
    );

    // Real-time synchronization subscription
    this.subscription.add(
      this.dashboardService.refreshData$.subscribe(() => {
        this.loadExpensesData();
      })
    );

    this.loadExpensesData();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadExpensesData(): void {
    this.isLoading.set(true);
    this.dashboardService.getSummary().subscribe({
      next: (summary) => {
        this.currentBalance.set(summary.balance ?? 0);
        this.saldoFormatted.set(summary.saldo ?? 'Q0.00');
      },
      error: (err) => console.warn('Error al obtener balance en egresos:', err),
    });

    this.dashboardService.getTransactions({ type: 'income', limit: 1000 }).subscribe({
      next: (incomes) => {
        this.allIncomes.set(incomes || []);
      },
      error: (err) => console.warn('Error al cargar ingresos para referencia en egresos:', err),
    });

    this.dashboardService.getTransactions({ type: 'expense', limit: 1000 }).subscribe({
      next: (txs) => {
        this.allExpenses.set(txs || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar egresos desde PostgreSQL:', err);
        this.isLoading.set(false);
        this.showToast('Error al conectar con la base de datos PostgreSQL.', 'error');
      },
    });
  }

  loadCategories(): void {
    this.dashboardService.getCategories().subscribe({
      next: (cats) => {
        if (cats && Array.isArray(cats) && cats.length > 0) {
          this.categories.set(cats.filter((c) => (c.type || '').toLowerCase() === 'expense'));
        } else {
          this.categories.set(DEFAULT_CATEGORIES.filter((c) => c.type === 'expense'));
        }
      },
      error: (err) => {
        console.warn('Categorías por defecto cargadas:', err);
        this.categories.set(DEFAULT_CATEGORIES.filter((c) => c.type === 'expense'));
      },
    });
  }

  onMonthChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedMonth.set(parseInt(select.value, 10));
  }

  user() {
    return this.authService.getCurrentUser();
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  // --- REGISTRAR NUEVO EGRESO ---
  openNewOperationModal(): void {
    this.opTitle.set('');
    this.opSubtitle.set('');
    this.opAmount.set(null);
    this.opCategoryId.set(null);
    this.opDate.set(getTodayLocalDateString());
    this.opStatus.set('Completado');
    this.showNewOperationModal.set(true);
    this.closeMobileMenu();
  }

  closeNewOperationModal(): void {
    this.showNewOperationModal.set(false);
  }

  onCategorySelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const catId = select.value ? parseInt(select.value, 10) : null;
    this.opCategoryId.set(catId);
    if (catId) {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat && (!this.opSubtitle() || this.opSubtitle() === 'Gasto General')) {
        this.opSubtitle.set(cat.name);
      }
    }
  }

  saveExpense(): void {
    const title = this.opTitle().trim();
    const amount = this.opAmount();
    const categoryId = this.opCategoryId() || undefined;
    const transactionDate = this.opDate() || getTodayLocalDateString();
    const subtitle =
      this.opSubtitle().trim() ||
      (categoryId ? this.categories().find((c) => c.id === categoryId)?.name : '') ||
      'Gasto General';
    const status = this.opStatus();

    if (!title) {
      this.showToast('Por favor, ingresa una descripción para el egreso.', 'error');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Por favor, ingresa un monto válido mayor a 0.', 'error');
      return;
    }

    if (this.currentBalance() <= 0) {
      this.showToast('No puedes registrar ningún egreso porque no tienes dinero disponible en tu cuenta.', 'error');
      return;
    }

    if (amount > this.currentBalance()) {
      this.showToast(
        `Saldo insuficiente. Tu saldo disponible es de ${this.saldoFormatted()} y no cubre el egreso de Q${amount.toFixed(2)}.`,
        'error'
      );
      return;
    }

    this.isSubmitting.set(true);
    this.dashboardService
      .createTransaction({
        title,
        subtitle,
        amount,
        type: 'expense',
        status,
        categoryId,
        transactionDate,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showNewOperationModal.set(false);
          this.showToast('¡Egreso registrado en PostgreSQL exitosamente!', 'success');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.showToast(err?.error?.message ?? 'Error al guardar el egreso en PostgreSQL.', 'error');
        },
      });
  }

  // --- EDITAR EGRESO ---
  openEditModal(item: TransactionItem): void {
    this.editingItem.set(item);
    this.editId.set(item.id);
    this.editTitle.set(item.title);
    this.editSubtitle.set(item.subtitle || '');
    this.editAmount.set(item.amount);
    this.editCategoryId.set(item.categoryId || null);
    this.editDate.set(item.rawDate || getTodayLocalDateString());
    this.editStatus.set(item.status || 'Completado');

    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingItem.set(null);
  }

  onEditCategorySelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const catId = select.value ? parseInt(select.value, 10) : null;
    this.editCategoryId.set(catId);
    if (catId) {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat && (!this.editSubtitle() || this.editSubtitle() === 'Gasto General')) {
        this.editSubtitle.set(cat.name);
      }
    }
  }

  saveEditExpense(): void {
    const id = this.editId();
    if (!id) return;

    const title = this.editTitle().trim();
    const amount = this.editAmount();
    const categoryId = this.editCategoryId() || undefined;
    const transactionDate = this.editDate() || getTodayLocalDateString();
    const subtitle =
      this.editSubtitle().trim() ||
      (categoryId ? this.categories().find((c) => c.id === categoryId)?.name : '') ||
      'Gasto General';
    const status = this.editStatus();

    if (!title) {
      this.showToast('Por favor, ingresa una descripción para el egreso.', 'error');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Por favor, ingresa un monto válido mayor a 0.', 'error');
      return;
    }

    const oldAmount = this.editingItem()?.amount || 0;
    const available = this.currentBalance() + oldAmount;

    if (available <= 0) {
      this.showToast('No puedes registrar este egreso porque no tienes dinero disponible en tu cuenta.', 'error');
      return;
    }

    if (amount > available) {
      this.showToast(
        `Saldo insuficiente. El saldo disponible para este egreso es de Q${available.toFixed(2)}.`,
        'error'
      );
      return;
    }

    this.isEditSubmitting.set(true);
    this.dashboardService
      .updateTransaction(id, {
        title,
        subtitle,
        amount,
        type: 'expense',
        status,
        categoryId: categoryId || null,
        transactionDate,
      })
      .subscribe({
        next: () => {
          this.isEditSubmitting.set(false);
          this.showEditModal.set(false);
          this.editingItem.set(null);
          this.showToast('¡Egreso actualizado con éxito en PostgreSQL!', 'success');
        },
        error: (err) => {
          this.isEditSubmitting.set(false);
          this.showToast(err?.error?.message ?? 'Error al actualizar el egreso.', 'error');
        },
      });
  }

  // --- ELIMINAR EGRESO ---
  openDeleteConfirm(item: TransactionItem): void {
    this.deletingItem.set(item);
    this.showDeleteConfirmModal.set(true);
  }

  closeDeleteConfirm(): void {
    this.showDeleteConfirmModal.set(false);
    this.deletingItem.set(null);
  }

  confirmDelete(): void {
    const item = this.deletingItem();
    if (!item) return;

    this.isDeleting.set(true);
    this.dashboardService.deleteTransaction(item.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.showDeleteConfirmModal.set(false);
        this.deletingItem.set(null);
        this.showToast('¡Egreso eliminado de la base de datos con éxito!', 'success');
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar el egreso en PostgreSQL.', 'error');
      },
    });
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
    this.toastType.set(type);
    this.toastMessage.set(message);
    setTimeout(() => {
      if (this.toastMessage() === message) {
        this.toastMessage.set(null);
      }
    }, 4500);
  }

  exportCSV(): void {
    const items = this.filteredExpenses();
    if (items.length === 0) {
      this.showToast('No hay registros de egresos para exportar en este período.', 'info');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,ID,Referencia,Categoria,Fecha,Estado,Monto (GTQ)\n';
    items.forEach((item) => {
      csvContent += `${item.id},"${item.title}","${item.categoryName || item.subtitle}",${item.transactionDate},${item.status},${item.amount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Egresos_${this.selectedMonth()}_${this.selectedYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('¡Reporte de egresos exportado correctamente en CSV!', 'success');
  }
}

