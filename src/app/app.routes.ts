import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { publicGuard } from './core/guards/public.guard';

export const routes: Routes = [
  // ── Public pages ───────────────────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'explore',
    loadComponent: () => import('./pages/explore/explore.component').then(m => m.ExploreComponent),
  },
  {
    path: 'tours/:variantId',
    loadComponent: () => import('./pages/tour-detail/tour-detail.component').then(m => m.TourDetailComponent),
  },
  {
    path: 'creators/:username',
    loadComponent: () => import('./pages/creator-profile/creator-profile.component').then(m => m.CreatorProfileComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'health',
    loadComponent: () => import('./pages/health/health.component').then(m => m.HealthComponent),
  },

  // ── Accept translation invite (public — user may not be logged in) ─────────
  {
    path: 'auth/accept-invite/:token',
    loadComponent: () => import('./pages/accept-invite/accept-invite.component').then(m => m.AcceptInviteComponent),
  },

  // ── Support: open a ticket via admin invite token (public, no auth) ───────
  {
    path: 'support/new/:token',
    loadComponent: () => import('./pages/support-new/support-new.component').then(m => m.SupportNewComponent),
  },

  // ── Auth (redirect if already logged in) ───────────────────────────────────
  {
    path: 'auth',
    canActivate: [publicGuard],
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },

  // ── Translation Marketplace (public) ───────────────────────────────────────
  {
    path: 'translation-marketplace',
    loadChildren: () => import('./features/translation-marketplace/translation-marketplace.routes')
      .then(m => m.TRANSLATION_MARKETPLACE_ROUTES),
  },

  // ── Tour Requests (public browse, auth for new/fulfill) ───────────────────
  {
    path: 'tour-requests',
    loadChildren: () => import('./features/tour-requests/tour-requests.routes')
      .then(m => m.TOUR_REQUESTS_ROUTES),
  },

  // ── Consumer Library ───────────────────────────────────────────────────────
  {
    path: 'library',
    canActivate: [authGuard],
    loadChildren: () => import('./features/library/library.routes').then(m => m.LIBRARY_ROUTES),
  },

  // ── Creator Studio ─────────────────────────────────────────────────────────
  {
    path: 'studio',
    canActivate: [authGuard],
    loadChildren: () => import('./features/studio/studio.routes').then(m => m.STUDIO_ROUTES),
  },

  // ── Contributor Jobs ───────────────────────────────────────────────────────
  // {
  //   path: 'jobs',
  //   canActivate: [authGuard],
  //   loadChildren: () => import('./features/jobs/jobs.routes').then(m => m.JOBS_ROUTES),
  // },

  // ── Checkout ───────────────────────────────────────────────────────────────
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadChildren: () => import('./features/checkout/checkout.routes').then(m => m.CHECKOUT_ROUTES),
  },

  // ── Account ────────────────────────────────────────────────────────────────
  {
    path: 'account',
    canActivate: [authGuard],
    loadChildren: () => import('./features/account/account.routes').then(m => m.ACCOUNT_ROUTES),
  },

  // ── Admin (auth handled inside the feature) ────────────────────────────────
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },

  // ── Fallback ───────────────────────────────────────────────────────────────
  {
    path: '**',
    redirectTo: '',
  },
];
