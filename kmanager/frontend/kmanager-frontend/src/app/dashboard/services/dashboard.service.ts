import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardSummary,
  CreateTransactionDto,
  UpdateTransactionDto,
  Category,
  QuickExpense,
  CreateQuickExpenseDto,
  TransactionItem,
} from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  // Real-time synchronization event bus across components
  private refreshSubject = new Subject<void>();
  readonly refreshData$ = this.refreshSubject.asObservable();

  notifyDataChanged(): void {
    this.refreshSubject.next();
  }

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard/summary`);
  }

  getTransactions(filters?: { type?: string; month?: number; year?: number; limit?: number }): Observable<TransactionItem[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.type) params = params.set('type', filters.type);
      if (filters.month) params = params.set('month', filters.month.toString());
      if (filters.year) params = params.set('year', filters.year.toString());
      if (filters.limit) params = params.set('limit', filters.limit.toString());
    }
    return this.http.get<TransactionItem[]>(`${this.apiUrl}/dashboard/transactions`, { params });
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/dashboard/categories`);
  }

  getQuickExpenses(): Observable<QuickExpense[]> {
    return this.http.get<QuickExpense[]>(`${this.apiUrl}/dashboard/quick-expenses`);
  }

  createQuickExpense(dto: CreateQuickExpenseDto): Observable<QuickExpense> {
    return this.http.post<QuickExpense>(`${this.apiUrl}/dashboard/quick-expenses`, dto).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  createTransaction(dto: CreateTransactionDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/dashboard/transactions`, dto).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  updateTransaction(id: string | number, dto: UpdateTransactionDto): Observable<any> {
    return this.http.patch(`${this.apiUrl}/dashboard/transactions/${id}`, dto).pipe(
      tap(() => this.notifyDataChanged())
    );
  }

  deleteTransaction(id: string | number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/dashboard/transactions/${id}`).pipe(
      tap(() => this.notifyDataChanged())
    );
  }
}