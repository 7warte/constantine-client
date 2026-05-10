import { Routes } from '@angular/router';
import { adminGuard } from './admin.guard';

export const ADMIN_ROUTES: Routes = [
  // Login lives outside the guarded shell.
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/admin-login.component').then(m => m.AdminLoginComponent),
  },

  // Everything else is behind the admin shell + guard.
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },

      {
        path: 'overview',
        loadComponent: () =>
          import('./pages/overview/admin-overview.component').then(m => m.AdminOverviewComponent),
      },

      // ── Stubs (filled in later phases) ────────────────────────────────────
      {
        path: 'users',
        data: { title: 'Users' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'tours',
        data: { title: 'Tours' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'featured',
        data: { title: 'Featured tours' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'money-flow',
        data: { title: 'Money flow' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'refunds',
        data: { title: 'Refunds' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'taxes',
        data: { title: 'Taxes (Netherlands)' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'tickets',
        data: { title: 'Tickets' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'reports',
        data: { title: 'Reports' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'translation-jobs',
        data: { title: 'Translation jobs' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'todos',
        data: { title: 'To-do list' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'error-logs',
        data: { title: 'Error logs' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'email-logs',
        data: { title: 'Email log' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'legal/:slug',
        data: { title: 'Legal documents' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'analytics',
        data: { title: 'Analytics' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
