import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { internalReturnUrl } from '../auth/return-url';

// Redirect authenticated users away from auth pages — honouring a returnUrl if one
// was carried in (e.g. they followed a "sign in to continue" link, then realised
// they were already signed in).
export const publicGuard: CanActivateFn = (route) => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return true;

  const target = internalReturnUrl(route.queryParamMap.get('returnUrl')) ?? '/explore';
  return router.parseUrl(target);
};
