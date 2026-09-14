import { Injectable, PLATFORM_ID, NgZone, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subject, Observable } from 'rxjs';

// Tiempo de inactividad máximo: 15 minutos (en milisegundos)
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class ActivityTrackerService {
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private lastActivityTimestamp = Date.now();
  private inactivityCheckInterval: ReturnType<typeof setInterval> | null = null;
  private isTracking = false;

  private inactivityExpiredSubject = new Subject<void>();
  readonly inactivityExpired$: Observable<void> = this.inactivityExpiredSubject.asObservable();

  private boundActivityHandler = this.onUserActivity.bind(this);
  private lastThrottledTime = 0;

  /**
   * Registra actividad manualmente (ej. llamadas HTTP o acciones programáticas).
   */
  recordActivity(): void {
    this.lastActivityTimestamp = Date.now();
  }

  getLastActivity(): number {
    return this.lastActivityTimestamp;
  }

  isInactive(timeoutMs: number = DEFAULT_INACTIVITY_TIMEOUT_MS): boolean {
    return Date.now() - this.lastActivityTimestamp >= timeoutMs;
  }

  /**
   * Inicia el rastreo de eventos del usuario en el navegador fuera de la zona de Angular
   * para no disparar ciclos de detección de cambios innecesarios.
   */
  startTracking(timeoutMs: number = DEFAULT_INACTIVITY_TIMEOUT_MS): void {
    if (!this.isBrowser || this.isTracking) return;

    this.isTracking = true;
    this.recordActivity();

    this.ngZone.runOutsideAngular(() => {
      const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach((eventName) => {
        window.addEventListener(eventName, this.boundActivityHandler, { passive: true });
      });

      this.stopTrackingInterval();
      // Chequear inactividad cada 10 segundos
      this.inactivityCheckInterval = setInterval(() => {
        if (this.isInactive(timeoutMs)) {
          this.ngZone.run(() => {
            this.inactivityExpiredSubject.next();
          });
        }
      }, 10000);
    });
  }

  stopTracking(): void {
    if (!this.isBrowser || !this.isTracking) return;

    this.isTracking = false;
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((eventName) => {
      window.removeEventListener(eventName, this.boundActivityHandler);
    });

    this.stopTrackingInterval();
  }

  private stopTrackingInterval(): void {
    if (this.inactivityCheckInterval) {
      clearInterval(this.inactivityCheckInterval);
      this.inactivityCheckInterval = null;
    }
  }

  private onUserActivity(): void {
    const now = Date.now();
    // Throttle a máximo 1 actualización por segundo
    if (now - this.lastThrottledTime > 1000) {
      this.lastThrottledTime = now;
      this.lastActivityTimestamp = now;
    }
  }
}
