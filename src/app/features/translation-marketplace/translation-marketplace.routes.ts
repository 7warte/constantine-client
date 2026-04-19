import { Routes } from '@angular/router';

export const TRANSLATION_MARKETPLACE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/marketplace-list/marketplace-list.component')
      .then(m => m.MarketplaceListComponent),
  },
  {
    path: ':requestId',
    loadComponent: () => import('./pages/marketplace-detail/marketplace-detail.component')
      .then(m => m.MarketplaceDetailComponent),
  },
];
