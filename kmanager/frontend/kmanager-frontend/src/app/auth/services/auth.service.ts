import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, tap, throwError } from 'rxjs';
import { jwtDecode } from 'jwt-decode';
import { environment } from '../../../environments/environment';
import { AuthUser, LoginRequest, LoginResponse, Role } from '../models/user.model';
import { ActivityTrackerService } from './activity-tracker.service';

const ACCESS_TOKEN_KEY = 'kmanager_access_token';
const REFRESH_TOKEN_KEY = 'kmanager_refresh_token';
const USER_KEY = 'kmanager_user';

interface DecodedToken {
  sub: string;
  username: string;
  role: Role;
  exp: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private activityTracker = inject(ActivityTrackerService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // En el servidor (SSR) no hay localStorage, así que arrancamos sin usuario.
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(
    this.isBrowser ? this.getStoredUser() : null
  );
  readonly currentUser$ = this.currentUserSubject.asObservable();

  private tokenExpiredSubject = new BehaviorSubject<boolean>(false);
  readonly tokenExpired$ = this.tokenExpiredSubject.asObservable();

  private inactivitySubscription: Subscription | null = null;

  constructor() {
    if (this.isBrowser && this.isAuthenticated()) {
      this.initActivityTracking();
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => this.setSession(response))
    );
  }

  loginWithGoogle(credential: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/google`, { credential }).pipe(
      tap((response) => this.setSession(response))
    );
  }

  refreshToken(): Observable<LoginResponse> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<LoginResponse>(`${this.apiUrl}/refresh`, { refreshToken: refresh }).pipe(
      tap((response) => this.setSession(response))
    );
  }

  logout(): void {
    if (!this.isBrowser) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSubject.next(null);
    this.tokenExpiredSubject.next(false);
    this.stopActivityTracking();
  }

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    if (!this.isBrowser) return false;
    const token = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    if (!token && !refreshToken) return false;

    // Si el usuario no ha estado inactivo más del tiempo máximo permitido
    if (this.activityTracker.isInactive()) {
      return false;
    }

    // Si tiene refresh token o access token no expirado
    if (token && !this.isTokenExpired(token)) {
      return true;
    }

    return !!refreshToken;
  }

  hasRole(role: Role): boolean {
    return this.getCurrentUser()?.role === role;
  }

  private setSession(response: LoginResponse): void {
    if (this.isBrowser) {
      localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }
    this.currentUserSubject.next(response.user);
    this.tokenExpiredSubject.next(false);
    this.initActivityTracking();
  }

  private getStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const nowInSeconds = Date.now() / 1000;
      return decoded.exp < nowInSeconds;
    } catch {
      return true;
    }
  }

  private initActivityTracking(): void {
    if (!this.isBrowser) return;
    this.activityTracker.startTracking();

    if (!this.inactivitySubscription) {
      this.inactivitySubscription = this.activityTracker.inactivityExpired$.subscribe(() => {
        // La sesión ha expirado únicamente por inactividad
        this.tokenExpiredSubject.next(true);
        this.logout();
      });
    }
  }

  private stopActivityTracking(): void {
    this.activityTracker.stopTracking();
    if (this.inactivitySubscription) {
      this.inactivitySubscription.unsubscribe();
      this.inactivitySubscription = null;
    }
  }

  startExpirationCheck(): void {
    // Inicia el tracking de actividad e inactividad en componentes
    this.initActivityTracking();
  }

  stopExpirationCheck(): void {
    // Mantiene compatibilidad con componentes que llaman a este método
  }
}