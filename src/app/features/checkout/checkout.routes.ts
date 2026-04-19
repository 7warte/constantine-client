import { Routes } from '@angular/router';

export const CHECKOUT_ROUTES: Routes = [
  {
    path: 'confirmation/success',
    loadComponent: () => import('./pages/confirmation/confirmation.component').then(m => m.ConfirmationComponent),
  },
  {
    path: 'confirmation/:purchaseId',
    loadComponent: () => import('./pages/confirmation/confirmation.component').then(m => m.ConfirmationComponent),
  },
  {
    path: ':variantId',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
  },
];
