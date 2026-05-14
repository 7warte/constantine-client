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
        path: 'money-flow',
        loadComponent: () =>
          import('./pages/money-flow/admin-money-flow.component').then(m => m.AdminMoneyFlowComponent),
      },
      {
        path: 'refunds',
        loadComponent: () =>
          import('./pages/refunds/admin-refunds.component').then(m => m.AdminRefundsComponent),
      },
      {
        path: 'taxes',
        loadComponent: () =>
          import('./pages/taxes/admin-taxes.component').then(m => m.AdminTaxesComponent),
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
        loadComponent: () =>
          import('./pages/todos/admin-todos.component').then(m => m.AdminTodosComponent),
      },
      {
        path: 'error-logs',
        data: { title: 'Error logs' },
        loadComponent: () =>
          import('./pages/placeholder/admin-placeholder.component').then(m => m.AdminPlaceholderComponent),
      },
      {
        path: 'email-logs',
        loadComponent: () =>
          import('./pages/email-logs/admin-email-logs.component').then(m => m.AdminEmailLogsComponent),
      },
      {
        path: 'legal/:slug',
        loadComponent: () =>
          import('./pages/legal/admin-legal.component').then(m => m.AdminLegalComponent),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/analytics/admin-analytics.component').then(m => m.AdminAnalyticsComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
