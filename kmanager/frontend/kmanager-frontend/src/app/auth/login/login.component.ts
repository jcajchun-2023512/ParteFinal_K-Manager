import { Component, OnInit, OnDestroy, inject, signal, PLATFORM_ID, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, Params } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    google?: any;
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly isLoading = signal<boolean>(false);
  readonly isGoogleLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal<boolean>(false);
  readonly googleConfigured = signal<boolean>(!!environment.googleClientId && !environment.googleClientId.includes('TU_GOOGLE_CLIENT_ID'));

  form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePasswordVisibility(): void {
    this.showPassword.update((val: boolean) => !val);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params: Params) => {
      if (params['expired'] === 'true' || params['expired'] === 'inactivity') {
        this.errorMessage.set('Tu sesión ha finalizado por inactividad. Por favor, ingresa de nuevo.');
      }
    });

    if (this.isBrowser) {
      this.loadGoogleScript();
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  get username() {
    return this.form.controls.username;
  }

  get password() {
    return this.form.controls.password;
  }

  private loadGoogleScript(): void {
    if (document.getElementById('google-jssdk')) {
      this.initGoogleSignIn();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.initGoogleSignIn();
    };
    document.body.appendChild(script);
  }

  private initGoogleSignIn(): void {
    if (!this.isBrowser || !window.google?.accounts?.id) return;

    try {
      const clientId = environment.googleClientId || '';
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: any) => {
          this.ngZone.run(() => {
            this.handleGoogleCredentialResponse(response);
          });
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      const btnContainer = document.getElementById('googleSignInBtn');
      if (btnContainer) {
        window.google.accounts.id.renderButton(btnContainer, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
          width: 320,
        });
      }
    } catch (e) {
      console.warn('[LoginComponent] Advertencia al inicializar Google Identity Services:', e);
    }
  }

  handleGoogleCredentialResponse(response: any): void {
    if (!response?.credential) {
      this.errorMessage.set('No se recibió la credencial de autenticación de Google.');
      return;
    }

    this.isGoogleLoading.set(true);
    this.errorMessage.set(null);

    this.authService.loginWithGoogle(response.credential).subscribe({
      next: () => {
        this.isGoogleLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isGoogleLoading.set(false);
        this.errorMessage.set(
          err?.error?.message ?? 'Error al iniciar sesión con Google. Intenta nuevamente.'
        );
      },
    });
  }

  triggerGooglePrompt(): void {
    if (this.isBrowser && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      this.errorMessage.set('El servicio de Google aún se está cargando. Intenta en unos segundos.');
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.form.getRawValue();

    this.authService.login({ username: username!, password: password! }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.message ?? 'No se pudo iniciar sesión. Intenta de nuevo.'
        );
      },
    });
  }
}