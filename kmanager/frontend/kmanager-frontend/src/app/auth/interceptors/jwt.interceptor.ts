import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ActivityTrackerService } from '../services/activity-tracker.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const activityTracker = inject(ActivityTrackerService);

  // Registrar actividad por llamada HTTP
  activityTracker.recordActivity();

  // Rutas públicas de autenticación no requieren interceptación de token
  const isAuthEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/google') ||
    req.url.includes('/auth/refresh');

  const token = authService.getAccessToken();

  let authReq = req;
  if (token && !isAuthEndpoint) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        return handle401Error(authReq, next, authService, router);
      }
      return throwError(() => error);
    })
  );
};

function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router
) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = authService.getRefreshToken();
    if (!refreshToken) {
      isRefreshing = false;
      authService.logout();
      router.navigate(['/login'], { queryParams: { expired: 'true' } });
      return throwError(() => new Error('No refresh token available'));
    }

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        refreshTokenSubject.next(response.accessToken);

        return next(
          req.clone({
            setHeaders: { Authorization: `Bearer ${response.accessToken}` },
          })
        );
      }),
      catchError((refreshError) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        authService.logout();
        router.navigate(['/login'], { queryParams: { expired: 'true' } });
        return throwError(() => refreshError);
      })
    );
  } else {
    // Si ya hay un refresh en curso, esperar a que emita el nuevo token y reintentar
    return refreshTokenSubject.pipe(
      filter((newToken) => newToken !== null),
      take(1),
      switchMap((newToken) => {
        return next(
          req.clone({
            setHeaders: { Authorization: `Bearer ${newToken}` },
          })
        );
      })
    );
  }
}

