import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/services/auth.service';
import { DashboardService } from '../dashboard/services/dashboard.service';
import {
  Category,
  TransactionItem,
} from '../dashboard/models/dashboard.model';
import { DEFAULT_CATEGORIES, getTodayLocalDateString } from '../dashboard/dashboard.component';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './historial.component.html',
  styleUrl: './historial.component.css',
})
export class HistorialComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  private router = inject(Router);
  private subscription = new Subscription();

  // State Signals
  readonly allTransactions = signal<TransactionItem[]>([]);
  readonly currentBalance = signal<number>(0);
  readonly saldoFormatted = signal<string>('Q0.00');
  readonly categories = signal<Category[]>(DEFAULT_CATEGORIES);
  readonly isLoading = signal<boolean>(true);
  readonly sessionExpired = signal<boolean>(false);
  readonly mobileMenuOpen = signal<boolean>(false);

  // Interactive Filter Signals
  readonly searchTerm = signal<string>('');
  readonly selectedType = signal<'all' | 'income' | 'expense'>('all');
  readonly selectedCategory = signal<string>('all');
  readonly selectedDateRange = signal<string>('30days');

  // Pagination Signals
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(10);

  // Filtered Transactions
  readonly filteredTransactions = computed<TransactionItem[]>(() => {
    let list = this.allTransactions();
    const search = this.searchTerm().toLowerCase().trim();
    const type = this.selectedType();
    const category = this.selectedCategory();
    const dateRange = this.selectedDateRange();

    // 1. Filter by Type
    if (type !== 'all') {
      list = list.filter((item) => item.type === type);
    }

    // 2. Filter by Category
    if (category !== 'all') {
      list = list.filter((item) => {
        const itemCat = item.categoryName || item.subtitle || '';
        return itemCat.toLowerCase() === category.toLowerCase();
      });
    }

    // 3. Filter by Search Term
    if (search) {
      list = list.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(search);
        const subtitleMatch = (item.subtitle || '').toLowerCase().includes(search);
        const catMatch = (item.categoryName || '').toLowerCase().includes(search);
        const idMatch = `txn-${item.id}`.includes(search) || item.id.toString().includes(search);
        return titleMatch || subtitleMatch || catMatch || idMatch;
      });
    }

    // 4. Filter by Date Range
    if (dateRange !== 'all' && list.length > 0) {
      const now = new Date();
      let days = 30;
      if (dateRange === 'quarter') days = 90;
      if (dateRange === 'year') days = 365;

      const cutoff = new Date();
      cutoff.setDate(now.getDate() - days);

      list = list.filter((item) => {
        if (!item.rawDate) return true;
        const itemDate = new Date(`${item.rawDate}T12:00:00Z`);
        return itemDate >= cutoff;
      });
    }

    return list;
  });

  // KPI Computations
  readonly totalMovementsVolume = computed<number>(() => {
    return this.filteredTransactions().reduce((sum, item) => sum + item.amount, 0);
  });

  readonly totalIncomeSum = computed<number>(() => {
    return this.filteredTransactions()
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
  });

  readonly totalExpenseSum = computed<number>(() => {
    return this.filteredTransactions()
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
  });

  readonly auditedCount = computed<number>(() => {
    return this.filteredTransactions().length;
  });

  // Pagination Computations
  readonly totalPages = computed<number>(() => {
    const total = this.filteredTransactions().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  readonly paginatedTransactions = computed<TransactionItem[]>(() => {
    const list = this.filteredTransactions();
    const page = Math.min(this.currentPage(), this.totalPages());
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  readonly showingStart = computed<number>(() => {
    if (this.filteredTransactions().length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages());
    return (page - 1) * this.pageSize() + 1;
  });

  readonly showingEnd = computed<number>(() => {
    const total = this.filteredTransactions().length;
    const page = Math.min(this.currentPage(), this.totalPages());
    return Math.min(page * this.pageSize(), total);
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
  readonly opType = signal<'income' | 'expense'>('income');
  readonly opSubtitle = signal<string>('');
  readonly opCategoryId = signal<number | null>(null);
  readonly opDate = signal<string>(getTodayLocalDateString());
  readonly opStatus = signal<'Completado' | 'Pendiente' | 'Cancelado'>('Completado');

  // Edit Form Signals
  readonly editId = signal<number | null>(null);
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

    // Real-time synchronization subscription
    this.subscription.add(
      this.dashboardService.refreshData$.subscribe(() => {
        this.loadHistoryData();
      })
    );

    this.loadHistoryData();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadHistoryData(): void {
    this.isLoading.set(true);
    this.dashboardService.getSummary().subscribe({
      next: (summary) => {
        this.currentBalance.set(summary.balance ?? 0);
        this.saldoFormatted.set(summary.saldo ?? 'Q0.00');
      },
      error: (err) => console.warn('Error al obtener balance en historial:', err),
    });

    this.dashboardService.getTransactions({ limit: 1000 }).subscribe({
      next: (txs) => {
        this.allTransactions.set(txs || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar historial desde PostgreSQL:', err);
        this.isLoading.set(false);
        this.showToast('Error al conectar con la base de datos PostgreSQL.', 'error');
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
        console.warn('Categorías por defecto cargadas:', err);
        this.categories.set(DEFAULT_CATEGORIES);
      },
    });
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

  // Filter setters
  setTypeFilter(type: 'all' | 'income' | 'expense'): void {
    this.selectedType.set(type);
    this.currentPage.set(1);
  }

  onCategoryFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedCategory.set(select.value);
    this.currentPage.set(1);
  }

  onDateRangeFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedDateRange.set(select.value);
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedType.set('all');
    this.selectedCategory.set('all');
    this.selectedDateRange.set('30days');
    this.currentPage.set(1);
  }

  // Pagination controls
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.pageSize.set(parseInt(select.value, 10));
    this.currentPage.set(1);
  }

  // --- REGISTRAR NUEVA OPERACIÓN ---
  openNewOperationModal(): void {
    this.opTitle.set('');
    this.opSubtitle.set('');
    this.opAmount.set(null);
    this.opType.set('income');
    this.opCategoryId.set(null);
    this.opDate.set(getTodayLocalDateString());
    this.opStatus.set('Completado');
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

  get filteredFormCategories(): Category[] {
    const type = this.opType();
    return this.categories().filter((c) => (c.type || '').toLowerCase() === type.toLowerCase());
  }

  onCategorySelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const catId = select.value ? parseInt(select.value, 10) : null;
    this.opCategoryId.set(catId);
    if (catId) {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat && (!this.opSubtitle() || this.opSubtitle() === 'Ingreso Principal' || this.opSubtitle() === 'Gasto General')) {
        this.opSubtitle.set(cat.name);
      }
    }
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
    const status = this.opStatus();

    if (!title) {
      this.showToast('Por favor, ingresa una descripción para la transacción.', 'error');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Por favor, ingresa un monto válido mayor a 0.', 'error');
      return;
    }

    if (type === 'expense') {
      if (this.currentBalance() <= 0) {
        this.showToast('No puedes registrar un egreso porque no tienes dinero disponible en tu cuenta.', 'error');
        return;
      }
      if (amount > this.currentBalance()) {
        this.showToast(
          `Saldo insuficiente. Tu saldo disponible es de ${this.saldoFormatted()} y no cubre el egreso de Q${amount.toFixed(2)}.`,
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
        status,
        categoryId,
        transactionDate,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.showNewOperationModal.set(false);
          this.showToast('¡Transacción registrada en PostgreSQL exitosamente!', 'success');
        },
        error: (err) => {
          this.isSubmitting.set(false);
          this.showToast(err?.error?.message ?? 'Error al guardar la transacción en PostgreSQL.', 'error');
        },
      });
  }

  // --- EDITAR TRANSACCIÓN ---
  openEditModal(item: TransactionItem): void {
    this.editingItem.set(item);
    this.editId.set(item.id);
    this.editTitle.set(item.title);
    this.editSubtitle.set(item.subtitle || '');
    this.editAmount.set(item.amount);
    this.editType.set(item.type);
    this.editCategoryId.set(item.categoryId || null);
    this.editDate.set(item.rawDate || getTodayLocalDateString());
    this.editStatus.set(item.status || 'Completado');

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

  get editFilteredFormCategories(): Category[] {
    const type = this.editType();
    return this.categories().filter((c) => (c.type || '').toLowerCase() === type.toLowerCase());
  }

  onEditCategorySelectChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const catId = select.value ? parseInt(select.value, 10) : null;
    this.editCategoryId.set(catId);
    if (catId) {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat && (!this.editSubtitle() || this.editSubtitle() === 'Ingreso Principal' || this.editSubtitle() === 'Gasto General')) {
        this.editSubtitle.set(cat.name);
      }
    }
  }

  saveEditTransaction(): void {
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
      this.showToast('Por favor, ingresa una descripción para la transacción.', 'error');
      return;
    }

    if (!amount || amount <= 0) {
      this.showToast('Por favor, ingresa un monto válido mayor a 0.', 'error');
      return;
    }

    if (type === 'expense') {
      const oldItem = this.editingItem();
      const isPositive = oldItem?.type === 'income';
      const oldAmount = oldItem?.amount || 0;
      const available = isPositive
        ? this.currentBalance() - oldAmount
        : this.currentBalance() + oldAmount;

      if (available <= 0) {
        this.showToast('No puedes cambiar a egreso porque no tienes dinero disponible en tu cuenta.', 'error');
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
          this.showToast('¡Transacción actualizada con éxito en PostgreSQL!', 'success');
        },
        error: (err) => {
          this.isEditSubmitting.set(false);
          this.showToast(err?.error?.message ?? 'Error al actualizar la transacción.', 'error');
        },
      });
  }

  // --- ELIMINAR TRANSACCIÓN ---
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
        this.showToast('¡Transacción eliminada de la base de datos con éxito!', 'success');
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar la transacción en PostgreSQL.', 'error');
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
    const items = this.filteredTransactions();
    if (items.length === 0) {
      this.showToast('No hay transacciones para exportar con los filtros seleccionados.', 'info');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,ID,Tipo,Referencia,Categoria,Fecha,Estado,Monto (GTQ)\n';
    items.forEach((item) => {
      csvContent += `${item.id},${item.type},"${item.title}","${item.categoryName || item.subtitle}",${item.transactionDate},${item.status},${item.amount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Historial_Transacciones_${getTodayLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('¡Reporte de historial exportado correctamente en CSV!', 'success');
  }
}

