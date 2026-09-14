import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { Role } from '../auth/models/user.model';
import { DashboardService } from './services/dashboard.service';
import {
  DashboardSummary,
  MonthlyHistoryItem,
  Category,
  QuickExpense,
  UpdateTransactionDto,
} from './models/dashboard.model';

export const DEFAULT_CATEGORIES: Category[] = [
  // Ingresos
  { id: 1, name: 'Nómina', type: 'income', icon: 'account_balance', color: 'emerald' },
  { id: 2, name: 'Consultoría', type: 'income', icon: 'trending_up', color: 'emerald' },
  { id: 3, name: 'Inversiones', type: 'income', icon: 'savings', color: 'emerald' },
  { id: 4, name: 'Freelance', type: 'income', icon: 'computer', color: 'purple' },
  { id: 5, name: 'Otros Ingresos', type: 'income', icon: 'payments', color: 'emerald' },
  // Egresos
  { id: 6, name: 'Hogar', type: 'expense', icon: 'home', color: 'blue' },
  { id: 7, name: 'Luz', type: 'expense', icon: 'bolt', color: 'yellow' },
  { id: 8, name: 'Agua', type: 'expense', icon: 'water_drop', color: 'cyan' },
  { id: 9, name: 'Internet', type: 'expense', icon: 'wifi', color: 'purple' },
  { id: 10, name: 'Tarjetas', type: 'expense', icon: 'credit_card', color: 'rose' },
  { id: 11, name: 'Supermercado', type: 'expense', icon: 'shopping_cart', color: 'rose' },
  { id: 12, name: 'Alquiler', type: 'expense', icon: 'home', color: 'blue' },
  { id: 13, name: 'Transporte', type: 'expense', icon: 'directions_car', color: 'amber' },
  { id: 14, name: 'Alimentación', type: 'expense', icon: 'restaurant', color: 'rose' },
  { id: 15, name: 'Salud', type: 'expense', icon: 'local_hospital', color: 'rose' },
  { id: 16, name: 'Educación', type: 'expense', icon: 'school', color: 'purple' },
  { id: 17, name: 'Entretenimiento', type: 'expense', icon: 'movie', color: 'purple' },
  { id: 18, name: 'Otros Gastos', type: 'expense', icon: 'receipt_long', color: 'rose' },
];

export function getTodayLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private subscription = new Subscription();

  // Dynamic Financial Data (from PostgreSQL via DashboardService)
  readonly totalIngresos = signal<string>('Q0.00');
  readonly totalEgresos = signal<string>('Q0.00');
  readonly saldo = signal<string>('Q0.00');
  readonly currentBalance = signal<number>(0);
  readonly ingresosTrend = signal<string>('+12.5% este mes');
  readonly porcentajeAhorro = signal<number>(0);
  readonly ahorradoMes = signal<string>('Q0.00');
  readonly monthlyHistory = signal<MonthlyHistoryItem[]>([]);
  readonly quickExpenses = signal<QuickExpense[]>([]);
  readonly categories = signal<Category[]>(DEFAULT_CATEGORIES);
  readonly isLoading = signal<boolean>(true);

  // UI Interactive States
  readonly showNewOperationModal = signal<boolean>(false);
  readonly showNewQuickExpenseModal = signal<boolean>(false);
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error' | 'info'>('info');
  readonly mobileMenuOpen = signal<boolean>(false);
  readonly sessionExpired = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly isSubmittingQuick = signal<boolean>(false);

  // --- EDICIÓN ---
  readonly showEditModal = signal<boolean>(false);
  readonly editingItem = signal<MonthlyHistoryItem | null>(null);
  readonly isEditSubmitting = signal<boolean>(false);

  // --- CONFIRMACIÓN DE ELIMINACIÓN ---
  readonly showDeleteConfirmModal = signal<boolean>(false);
  readonly deletingItem = signal<MonthlyHistoryItem | null>(null);
  readonly isDeleting = signal<boolean>(false);

  // Form Signals for New Operation
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

  // Form Signals for New Quick / Fixed Expense
  readonly quickTitle = signal<string>('');
  readonly quickCategoryId = signal<number | null>(null);
  readonly quickIcon = signal<string>('shopping_bag');
  readonly quickColor = signal<string>('rose');
  readonly quickAmount = signal<number | null>(null);

  // Predefined Available Icons for Quick Expenses
  readonly availableIcons = [
    { icon: 'home', label: 'Hogar' },
    { icon: 'bolt', label: 'Luz' },
    { icon: 'water_drop', label: 'Agua' },
    { icon: 'wifi', label: 'Internet' },
    { icon: 'credit_card', label: 'Tarjetas' },
    { icon: 'shopping_cart', label: 'Súper' },
    { icon: 'fitness_center', label: 'Gimnasio' },
    { icon: 'directions_car', label: 'Auto' },
    { icon: 'local_hospital', label: 'Salud' },
    { icon: 'school', label: 'Educación' },
    { icon: 'tv', label: 'Streaming' },
    { icon: 'restaurant', label: 'Comida' },
    { icon: 'pets', label: 'Mascotas' },
    { icon: 'receipt_long', label: 'Factura' },
  ];

  readonly availableColors = [
    { name: 'rose', label: 'Rosa / Rojo', hex: '#fb7185' },
    { name: 'blue', label: 'Azul', hex: '#60a5fa' },
    { name: 'yellow', label: 'Amarillo', hex: '#facc15' },
    { name: 'cyan', label: 'Celeste / Cyan', hex: '#22d3ee' },
    { name: 'purple', label: 'Morado', hex: '#c084fc' },
    { name: 'emerald', label: 'Esmeralda', hex: '#34d399' },
    { name: 'amber', label: 'Ámbar', hex: '#fbbf24' },
  ];

  ngOnInit(): void {
    this.authService.startExpirationCheck();
    this.subscription.add(
      this.authService.tokenExpired$.subscribe((expired) => {
        this.sessionExpired.set(expired);
      })
    );

    this.loadDashboardData();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadDashboardData(): void {
    this.isLoading.set(true);
    this.dashboardService.getSummary().subscribe({
      next: (summary: DashboardSummary) => {
        this.totalIngresos.set(summary.totalIngresos);
        this.totalEgresos.set(summary.totalEgresos);
        this.saldo.set(summary.saldo ?? 'Q0.00');
        this.currentBalance.set(summary.balance ?? 0);
        this.ingresosTrend.set(summary.ingresosTrend);
        this.porcentajeAhorro.set(summary.porcentajeAhorro);
        this.ahorradoMes.set(summary.ahorradoMes);
        this.quickExpenses.set(summary.quickExpenses || []);
        this.monthlyHistory.set(summary.monthlyHistory);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar datos de PostgreSQL:', err);
        this.isLoading.set(false);
        this.showToast('Error al conectar con la base de datos PostgreSQL.');
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
        console.warn('Categorías de respaldo activadas:', err);
        this.categories.set(DEFAULT_CATEGORIES);
      },
    });
  }

  get filteredCategories(): Category[] {
    const currentType = (this.opType() || 'income').toLowerCase();
    const list = this.categories() || DEFAULT_CATEGORIES;
    return list.filter((c) => (c.type || '').toLowerCase() === currentType);
  }

  user() {
    return this.authService.getCurrentUser();
  }

  get cardRoleTitle(): string {
    return this.user()?.role === Role.ADMIN ? 'Card Admin' : 'Card User';
  }

  get cardHolderName(): string {
    return this.user()?.role === Role.ADMIN ? 'CARD ADMIN' : 'CARD USER';
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

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

    if (type === 'expense') {
      if (this.currentBalance() <= 0) {
        this.showToast('No puedes registrar un egreso porque no tienes dinero disponible en tu cuenta.', 'error');
        return;
      }
      if (amount > this.currentBalance()) {
        this.showToast(
          `Saldo insuficiente. Tu saldo disponible es de ${this.saldo()} y no cubre el egreso de Q${amount.toFixed(2)}.`,
          'error'
        );
        return;
      }
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
          this.showToast(`¡${type === 'income' ? 'Ingreso' : 'Egreso'} registrado en PostgreSQL con éxito!`);
          this.loadDashboardData(); // Recarga en tiempo real
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.showToast(err?.error?.message ?? 'Error al guardar la operación en PostgreSQL.');
        },
      });
  }

  // --- NUEVO EGRESO FIJO / ACCESO RÁPIDO ---
  openNewQuickExpenseModal(): void {
    this.quickTitle.set('');
    this.quickCategoryId.set(null);
    this.quickIcon.set('shopping_bag');
    this.quickColor.set('rose');
    this.quickAmount.set(null);
    this.showNewQuickExpenseModal.set(true);
    this.closeMobileMenu();
  }

  closeNewQuickExpenseModal(): void {
    this.showNewQuickExpenseModal.set(false);
  }

  setQuickIcon(icon: string): void {
    this.quickIcon.set(icon);
  }

  setQuickColor(color: string): void {
    this.quickColor.set(color);
  }

  saveQuickExpense(): void {
    const title = this.quickTitle().trim();
    if (!title) {
      this.showToast('Por favor, ingresa el nombre para el egreso fijo.');
      return;
    }

    const defaultAmount = this.quickAmount();
    if (defaultAmount !== null && defaultAmount < 0) {
      this.showToast('El monto no puede ser negativo.');
      return;
    }

    this.isSubmittingQuick.set(true);
    this.dashboardService
      .createQuickExpense({
        title,
        categoryId: this.quickCategoryId() || undefined,
        icon: this.quickIcon(),
        color: this.quickColor(),
        defaultAmount: defaultAmount || 0,
      })
      .subscribe({
        next: () => {
          this.isSubmittingQuick.set(false);
          this.showNewQuickExpenseModal.set(false);
          this.showToast('¡Nuevo egreso fijo guardado en PostgreSQL!');
          this.loadDashboardData(); // Actualización inmediata sin recargar página
        },
        error: (err) => {
          this.isSubmittingQuick.set(false);
          this.showToast(err?.error?.message ?? 'Error al crear el egreso fijo.');
        },
      });
  }

  onQuickExpenseItemClick(item: QuickExpense): void {
    if (this.currentBalance() <= 0) {
      this.showToast(
        'No puedes realizar este egreso fijo porque no tienes dinero disponible en tu cuenta.',
        'error'
      );
      return;
    }
    this.openNewOperationModal(
      'expense',
      `Pago de ${item.title}`,
      item.title,
      item.categoryId || null,
      item.defaultAmount > 0 ? item.defaultAmount : null
    );
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

    if (type === 'expense') {
      const isPositive = this.editingItem()?.isPositive;
      const oldCleaned = (this.editingItem()?.amount || '').replace(/[^0-9.]/g, '');
      const oldAmount = parseFloat(oldCleaned) || 0;
      const available = isPositive
        ? this.currentBalance() - oldAmount
        : this.currentBalance() + oldAmount;

      if (available <= 0) {
        this.showToast('No puedes modificar a egreso porque no tienes dinero disponible en tu cuenta.', 'error');
        return;
      }
      if (amount > available) {
        this.showToast(
          `Saldo insuficiente. El saldo disponible para este egreso es de Q${available.toFixed(2)}.`,
          'error'
        );
        return;
      }
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
          this.loadDashboardData(); // Recarga en tiempo real
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
        this.loadDashboardData(); // Recarga en tiempo real
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar la operación dentro de PostgreSQL.', 'error');
      },
    });
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

  getQuickIconBg(color: string): string {
    const map: Record<string, string> = {
      blue: 'rgba(59,130,246,0.18)',
      yellow: 'rgba(234,179,8,0.18)',
      cyan: 'rgba(6,182,212,0.18)',
      purple: 'rgba(168,85,247,0.18)',
      rose: 'rgba(244,63,94,0.18)',
      emerald: 'rgba(16,185,129,0.18)',
      amber: 'rgba(245,158,11,0.18)',
    };
    return map[color] || 'rgba(244,63,94,0.18)';
  }

  getQuickIconColor(color: string): string {
    const map: Record<string, string> = {
      blue: '#60a5fa',
      yellow: '#facc15',
      cyan: '#22d3ee',
      purple: '#c084fc',
      rose: '#fb7185',
      emerald: '#34d399',
      amber: '#fbbf24',
    };
    return map[color] || '#fb7185';
  }
}