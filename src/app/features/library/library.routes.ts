import { Routes } from '@angular/router';

export const LIBRARY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/library-list/library-list.component').then(m => m.LibraryListComponent),
  },
  {
    path: ':purchaseId/play',
    loadComponent: () => import('./pages/tour-player/tour-player.component').then(m => m.TourPlayerComponent),
  },
];
