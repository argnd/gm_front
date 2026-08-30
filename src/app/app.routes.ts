import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

// Every page is lazy-loaded: /login pulls in its canvas engines, /home its decor registry,
// and neither pays for the other.
export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [authGuard],
  },
  // Unknown URLs land on /home, where the guard bounces anonymous visitors to /login
  { path: '**', redirectTo: 'home' },
];
