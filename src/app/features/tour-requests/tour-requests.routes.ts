import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const TOUR_REQUESTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/request-list/request-list.component')
      .then(m => m.RequestListComponent),
  },
  {
    path: 'new',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/request-new/request-new.component')
      .then(m => m.RequestNewComponent),
  },
  {
    path: ':requestId',
    loadComponent: () => import('./pages/request-detail/request-detail.component')
      .then(m => m.RequestDetailComponent),
  },
];
