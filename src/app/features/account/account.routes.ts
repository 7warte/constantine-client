import { Routes } from '@angular/router';

export const ACCOUNT_ROUTES: Routes = [
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: 'billing',
    loadComponent: () => import('./pages/billing/billing.component').then(m => m.BillingComponent),
  },
  {
    path: 'payouts',
    loadComponent: () => import('./pages/payouts/payouts.component').then(m => m.PayoutsComponent),
  },
  { path: '', redirectTo: 'profile', pathMatch: 'full' },
];
