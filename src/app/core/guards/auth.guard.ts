import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn() && auth.user()) return true;

  // Token exists but user data hasn't loaded yet (e.g. expired token cleared by init)
  if (!auth.isLoggedIn()) {
    return router.createUrlTree(['/auth/login']);
  }

  // Token exists but user not yet resolved — allow, init() will handle invalid tokens
  return true;
};
