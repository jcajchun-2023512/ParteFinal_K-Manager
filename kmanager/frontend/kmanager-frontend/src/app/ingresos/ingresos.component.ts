import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { Role } from '../auth/models/user.model';
import { DashboardService } from '../dashboard/services/dashboard.service';
import {
  DashboardSummary,
  MonthlyHistoryItem,
  TransactionItem,
  Category,
  UpdateTransactionDto,
} from '../dashboard/models/dashboard.model';
import { DEFAULT_CATEGORIES, getTodayLocalDateString } from '../dashboard/dashboard.component';

export interface ChartPoint {
  x: number;
  y: number;
  label: string;
  amount: number;
  amountFormatted: string;
  percentage: number;
}

@Component({
  selector: 'app-ingresos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ingresos.component.html',
  styleUrl: './ingresos.component.css',
})
export class IngresosComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private subscription = new Subscription();

  // Dynamic Financial Data (from PostgreSQL via DashboardService)
  readonly totalIngresos = signal<string>('Q0.00');
  readonly ingresosTrend = signal<string>('+12.5%');
  readonly incomeTransactions = signal<MonthlyHistoryItem[]>([]);
  readonly allRawIncomes = signal<TransactionItem[]>([]);
  readonly categories = signal<Category[]>(DEFAULT_CATEGORIES);
  readonly isLoading = signal<boolean>(true);
  readonly selectedPeriod = signal<'6m' | '1y'>('6m');

  // Computed state to verify if any income is registered
  readonly hasIncomes = computed<boolean>(() => {
    const list = this.incomeTransactions();
    return list.length > 0;
  });

  // Dynamic Month Objects (calculated backward from current month: { label, year, month })
  readonly chartMonths = computed<Array<{ label: string; year: number; month: number }>>(() => {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const count = this.selectedPeriod() === '6m' ? 6 : 12;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0..11
    const months: Array<{ label: string; year: number; month: number }> = [];

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({
        label: monthNames[d.getMonth()],
        year: d.getFullYear(),
        month: d.getMonth() + 1, // 1..12
      });
    }
    return months;
  });

  readonly chartMonthLabels = computed<string[]>(() => {
    return this.chartMonths().map((m) => m.label);
  });

  // Dynamic Chart Points (Real proportional values from PostgreSQL transactions)
  readonly chartPoints = computed<ChartPoint[]>(() => {
    const months = this.chartMonths();
    const count = months.length;
    const incomes = this.allRawIncomes();

    // 1. Calcular sumatoria real de ingresos por cada mes
    const monthlyTotals = months.map((m) => {
      let sum = 0;
      for (const item of incomes) {
        if (item.rawDate && item.status !== 'Cancelado') {
          const parts = item.rawDate.split('-');
          if (parts.length >= 2) {
            const itemYear = parseInt(parts[0], 10);
            const itemMonth = parseInt(parts[1], 10);
            if (itemYear === m.year && itemMonth === m.month) {
              sum += item.amount;
            }
          }
        }
      }
      return sum;
    });

    // 2. Establecer escala de referencia dinámica
    // Meta / techo de referencia base: Q10,000. Si se supera, se ajusta al máximo real + margen
    const maxRegistered = Math.max(...monthlyTotals, 0);
    const targetCeiling = Math.max(10000, maxRegistered > 0 ? maxRegistered * 1.15 : 10000);

    // 3. Mapear coordenadas SVG (viewBox 0 0 100 40)
    // Base (0%): y = 36 | Tope (100% de targetCeiling): y = 8 | Rango = 28 unidades
    return months.map((m, idx) => {
      const x = Math.round((idx / (count - 1)) * 100);
      const amount = monthlyTotals[idx];
      const ratio = targetCeiling > 0 ? amount / targetCeiling : 0;
      const percentage = Math.round(ratio * 100);

      let y: number;
      if (amount === 0) {
        y = 36;
      } else {
        // Altura proporcional calculada con precisión
        const calculatedY = 36 - Math.min(30, ratio * 28);
        y = Math.max(6, Math.round(calculatedY * 10) / 10);
      }

      return {
        x,
        y,
        label: m.label,
        amount,
        amountFormatted: `Q${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        percentage,
      };
    });
  });

  // Dynamic SVG Trend Line Path
  readonly chartLinePath = computed<string>(() => {
    const points = this.chartPoints();
    if (points.length === 0) return 'M 0,36 L 100,36';

    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x},${points[i].y}`;
    }
    return d;
  });

  // Dynamic SVG Gradient Area Path
  readonly chartAreaPath = computed<string>(() => {
    const line = this.chartLinePath();
    return `${line} L 100,40 L 0,40 Z`;
  });

  // UI Interactive States
  readonly showNewOperationModal = signal<boolean>(false);
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error' | 'info'>('info');
  readonly mobileMenuOpen = signal<boolean>(false);
  readonly sessionExpired = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  // --- EDICIÓN ---
  readonly showEditModal = signal<boolean>(false);
  readonly editingItem = signal<MonthlyHistoryItem | null>(null);
  readonly isEditSubmitting = signal<boolean>(false);

  // --- CONFIRMACIÓN DE ELIMINACIÓN ---
  readonly showDeleteConfirmModal = signal<boolean>(false);
  readonly deletingItem = signal<MonthlyHistoryItem | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Form Signals for New Operation (Exact same structure and behavior as Dashboard)
  readonly opTitle = signal<string>('');
  readonly opAmount = signal<number | null>(null);
  readonly opType = signal<'income' | 'expense'>('income');
  readonly opSubtitle = signal<string>('');
  readonly opCategoryId = signal<number | null>(null);
  readonly opDate = signal<string>(getTodayLocalDateString());

  // Form Signals for Edit Operation
  readonly editId = signal<string | number | null>(null);
  readonly editTitle = signal<string>('');
  readonly editAmount = signal<number | null>(null);
  readonly editType = signal<'income' | 'expense'>('income');
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

    this.subscription.add(
      this.dashboardService.refreshData$.subscribe(() => {
        this.loadIncomeData();
      })
    );

    this.loadIncomeData();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadIncomeData(): void {
    this.isLoading.set(true);

    this.dashboardService.getSummary().subscribe({
      next: (summary: DashboardSummary) => {
        this.totalIngresos.set(summary.totalIngresos);
        this.ingresosTrend.set(summary.ingresosTrend || '+12.5%');

        const history = summary.monthlyHistory || [];
        const incomesOnly = history.filter((item) => item.isPositive);
        this.incomeTransactions.set(incomesOnly);
      },
      error: (err) => {
        console.error('Error al cargar resumen de ingresos:', err);
      },
    });

    // Cargar todas las transacciones de ingreso para la gráfica cronológica
    this.dashboardService.getTransactions({ type: 'income' }).subscribe({
      next: (allIncomes: TransactionItem[]) => {
        this.allRawIncomes.set(allIncomes || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar lista de ingresos:', err);
        this.isLoading.set(false);
      },
    });
  }

  loadCategories(): void {
    this.dashboardService.getCategories().subscribe({
      next: (cats) => {
        if (cats && Array.isArray(cats) && cats.length > 0) {
          this.categories.set(cats);
        } else {
          this.categories.set(DEFAULT_CATEGORIES);
        }
      },
      error: (err) => {
        console.warn('Categorías de respaldo activadas para ingresos:', err);
        this.categories.set(DEFAULT_CATEGORIES);
      },
    });
  }

  user() {
    return this.authService.getCurrentUser();
  }

  get cardRoleTitle(): string {
    return this.user()?.role === Role.ADMIN ? 'Card Admin' : 'Card User';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // --- FORMULARIO NUEVA OPERACIÓN (IDÉNTICO AL DEL DASHBOARD) ---
  openNewOperationModal(
    defaultType: 'income' | 'expense' = 'income',
    defaultTitle = '',
    defaultSubtitle = '',
    defaultCategoryId: number | null = null,
    defaultAmount: number | null = null,
    defaultDate: string = getTodayLocalDateString()
  ): void {
    this.opType.set(defaultType);
    this.opTitle.set(defaultTitle);
    this.opSubtitle.set(defaultSubtitle);
    this.opCategoryId.set(defaultCategoryId);
    this.opAmount.set(defaultAmount);
    this.opDate.set(defaultDate);
    this.showNewOperationModal.set(true);
    this.closeMobileMenu();
  }

  closeNewOperationModal(): void {
    this.showNewOperationModal.set(false);
  }

  setOpType(type: 'income' | 'expense'): void {
    this.opType.set(type);
    this.opCategoryId.set(null);
  }

  get filteredCategories(): Category[] {
    const currentType = (this.opType() || 'income').toLowerCase();
    const list = this.categories() || DEFAULT_CATEGORIES;
    return list.filter((c) => (c.type || '').toLowerCase() === currentType);
  }

  onCategorySelected(catId: number | null): void {
    this.opCategoryId.set(catId);
    if (catId) {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat && (!this.opSubtitle() || this.opSubtitle() === 'Ingreso Principal' || this.opSubtitle() === 'Gasto General')) {
        this.opSubtitle.set(cat.name);
      }
    }
  }

  onCategorySelectChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const catId = target.value ? parseInt(target.value, 10) : null;
    this.onCategorySelected(catId);
  }

  saveOperation(): void {
    const title = this.opTitle().trim();
    const amount = this.opAmount();
    const type = this.opType();
    const categoryId = this.opCategoryId() || undefined;
    const transactionDate = this.opDate() || getTodayLocalDateString();
    const subtitle =
      this.opSubtitle().trim() ||
      (categoryId ? this.categories().find((c) => c.id === categoryId)?.name : '') ||
      (type === 'income' ? 'Ingreso Principal' : 'Gasto General');

    if (!title) {
      this.showToast('Por favor, ingresa una descripción para la operación.');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Por favor, ingresa un monto válido mayor a 0.');
      return;
    }

    this.isSubmitting.set(true);
    this.dashboardService
      .createTransaction({
        title,
        subtitle,
        amount,
        type,
        status: 'Completado',
        categoryId,
        transactionDate,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showNewOperationModal.set(false);
          this.showToast(
            `¡${type === 'income' ? 'Ingreso' : 'Operación'} guardado exitosamente en la base de datos!`,
            'success'
          );
          this.loadIncomeData(); // Recarga en tiempo real
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.showToast(err?.error?.message ?? 'Error al guardar la operación en PostgreSQL.', 'error');
        },
      });
  }

  onPeriodChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedPeriod.set(select.value === '1y' ? '1y' : '6m');
  }

  onFeatureClick(feature: string): void {
    this.showToast(`Módulo de ${feature}: conectado a la base de datos PostgreSQL.`);
    this.closeMobileMenu();
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

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  // --- GESTIÓN DE EDICIÓN DE OPERACIÓN ---
  openEditModal(item: MonthlyHistoryItem): void {
    this.editingItem.set(item);
    this.editId.set(item.id);
    this.editTitle.set(item.title);
    this.editSubtitle.set(item.subtitle);
    this.editType.set(item.isPositive ? 'income' : 'expense');
    this.editCategoryId.set(item.categoryId || null);
    this.editStatus.set((item.status as any) || 'Completado');

    // Extraer monto numérico
    const cleanedAmount = item.amount.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanedAmount);
    this.editAmount.set(isNaN(num) ? null : num);

    this.editDate.set(getTodayLocalDateString());
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingItem.set(null);
  }

  setEditOpType(type: 'income' | 'expense'): void {
    this.editType.set(type);
    this.editCategoryId.set(null);
  }

  get editFilteredCategories(): Category[] {
    const currentType = (this.editType() || 'income').toLowerCase();
    const list = this.categories() || DEFAULT_CATEGORIES;
    return list.filter((c) => (c.type || '').toLowerCase() === currentType);
  }

  onEditCategorySelected(catId: number | null): void {
    this.editCategoryId.set(catId);
    if (catId) {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat && (!this.editSubtitle() || this.editSubtitle() === 'Ingreso Principal' || this.editSubtitle() === 'Gasto General')) {
        this.editSubtitle.set(cat.name);
      }
    }
  }

  saveEditOperation(): void {
    const id = this.editId();
    if (!id) return;

    const title = this.editTitle().trim();
    const amount = this.editAmount();
    const type = this.editType();
    const categoryId = this.editCategoryId() || undefined;
    const transactionDate = this.editDate() || getTodayLocalDateString();
    const subtitle =
      this.editSubtitle().trim() ||
      (categoryId ? this.categories().find((c) => c.id === categoryId)?.name : '') ||
      (type === 'income' ? 'Ingreso Principal' : 'Gasto General');
    const status = this.editStatus();

    if (!title) {
      this.showToast('Por favor, ingresa una descripción para la operación.', 'error');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Por favor, ingresa un monto válido mayor a 0.', 'error');
      return;
    }

    this.isEditSubmitting.set(true);
    this.dashboardService
      .updateTransaction(id, {
        title,
        subtitle,
        amount,
        type,
        status,
        categoryId: categoryId || null,
        transactionDate,
      })
      .subscribe({
        next: () => {
          this.isEditSubmitting.set(false);
          this.showEditModal.set(false);
          this.editingItem.set(null);
          this.showToast('¡Operación actualizada con éxito en PostgreSQL!', 'success');
          this.loadIncomeData(); // Recarga en tiempo real
        },
        error: (err) => {
          this.isEditSubmitting.set(false);
          this.showToast(err?.error?.message ?? 'Error al actualizar la operación en PostgreSQL.', 'error');
        },
      });
  }

  // --- GESTIÓN DE ELIMINACIÓN DE OPERACIÓN ---
  openDeleteConfirm(item: MonthlyHistoryItem): void {
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
        this.showToast('¡Operación eliminada de la base de datos con éxito!', 'success');
        this.loadIncomeData(); // Recarga en tiempo real
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar la operación en PostgreSQL.', 'error');
      },
    });
  }

  formatIncomeAmount(amount: string): string {
    return amount.startsWith('+') ? amount.substring(1) : amount;
  }
}