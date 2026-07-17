import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { OfflineService } from '../offline/offline.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const offline = inject(OfflineService);

  // The saved offline tour's player never needs a live auth check — it's already
  // paid for, and requiring sign-in would strand the user when they're offline.
  // Match the URL directly so this holds even if navigator.onLine is unreliable
  // or the token was cleared in a previous offline session.
  const rec = offline.saved();
  if (rec && state.url.startsWith(`/library/${rec.purchaseId}/play`)) return true;

  // Any offline route while a tour is saved: allow (nothing to authenticate against).
  if (offline.offlineMode()) return true;

  if (auth.isLoggedIn() && auth.user()) return true;

  // Token exists but user data hasn't loaded yet (e.g. expired token cleared by init).
  // Remember where they were headed so we can send them back after they sign in —
  // this navigation is cancelled, so it never becomes a tracked "previous" page.
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  }

  // Token exists but user not yet resolved — allow, init() will handle invalid tokens
  return true;
};
