import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { APP_RELEASED } from '../app-release';

/**
 * Keeps the Downloads page unreachable until the app is actually on the App
 * Store. Hiding the menu link alone isn't enough — the URL would still resolve
 * for anyone who typed it, was linked to it, or had it bookmarked.
 */
export const releasedGuard: CanActivateFn = () => {
  const router = inject(Router);
  return APP_RELEASED ? true : router.createUrlTree(['/']);
};
