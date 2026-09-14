import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { authGuard, roleGuard } from './auth/guards/auth.guard';
import { Role } from './auth/models/user.model';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },

  // Dashboard principal
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },

  // Pestaña de Ingresos
  {
    path: 'ingresos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./ingresos/ingresos.component').then((m) => m.IngresosComponent),
  },

  // Pestaña de Egresos
  {
    path: 'egresos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./egresos/egresos.component').then((m) => m.EgresosComponent),
  },

  // Pestaña de Historial
  {
    path: 'historial',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./historial/historial.component').then((m) => m.HistorialComponent),
  },

  // Ejemplo de ruta protegida solo para Admin
  {
    path: 'admin',
    canActivate: [roleGuard([Role.ADMIN])],
    loadComponent: () =>
      import('./admin/admin.component').then((m) => m.AdminComponent),
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
