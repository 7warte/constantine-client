import { Routes } from '@angular/router';

export const STUDIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/studio-layout/studio-layout.component').then(m => m.StudioLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'tours',
        pathMatch: 'full',
      },
      {
        path: 'tours',
        loadComponent: () => import('./pages/tours-list/tours-list.component').then(m => m.ToursListComponent),
      },
      {
        path: 'blueprint',
        loadComponent: () => import('./pages/blueprint/blueprint.component').then(m => m.BlueprintComponent),
      },
      {
        path: 'requests',
        loadComponent: () => import('./pages/requests/requests.component').then(m => m.RequestsComponent),
      },
      {
        path: 'offer-job',
        loadComponent: () => import('./pages/translation-request-new/translation-request-new.component')
          .then(m => m.TranslationRequestNewComponent),
      },
      {
        path: 'promote',
        loadComponent: () => import('./pages/promote/promote.component').then(m => m.PromoteComponent),
      },
      {
        path: 'earnings',
        loadComponent: () => import('./pages/earnings/earnings.component').then(m => m.EarningsComponent),
      },
    ],
  },
  // Full-page routes (no sidebar)
  {
    path: 'tours/new',
    loadComponent: () => import('./pages/tour-edit/tour-edit.component').then(m => m.TourEditComponent),
  },
  {
    path: 'tours/:tourId',
    loadComponent: () => import('./pages/tour-edit/tour-edit.component').then(m => m.TourEditComponent),
  },
  {
    path: 'tours/:tourId/variants/:variantId',
    loadComponent: () => import('./pages/variant-edit/variant-edit.component').then(m => m.VariantEditComponent),
  },
];
