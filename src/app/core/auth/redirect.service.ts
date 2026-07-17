import { Injectable, inject } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs';
import { internalReturnUrl } from './return-url';

const isAuthUrl = (url: string): boolean => url === '/auth' || url.startsWith('/auth/');

/**
 * Remembers the page the user was on when they entered the auth flow, so after
 * signing in we can return them there instead of a generic landing page.
 *
 * It watches for a navigation *into* an auth page and snapshots the URL being
 * left — capturing exactly "the page he left before authenticating". Every
 * "Sign in / Sign up to continue" entry point benefits without passing anything
 * itself. An explicit `?returnUrl=` (e.g. set by the auth guard when it cancels a
 * navigation to a protected page) still takes precedence at the point of use.
 */
@Injectable({ providedIn: 'root' })
export class RedirectService {
  private readonly router = inject(Router);
  private previous: string | null = null;

  /** The safe, non-auth page the user was on before entering the auth flow (or null). */
  previousUrl(): string | null {
    return internalReturnUrl(this.previous);
  }

  /** Begin tracking. Called once from the root component at app start. */
  start(): void {
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe(e => {
        // Only when heading into the auth flow, and only after at least one real
        // navigation has completed (so a cold load straight onto /auth/* records
        // nothing) — snapshot the page currently being left.
        if (!isAuthUrl(e.url) || !this.router.navigated) return;
        const leaving = this.router.url;
        if (!isAuthUrl(leaving)) this.previous = leaving;
      });
  }
}
