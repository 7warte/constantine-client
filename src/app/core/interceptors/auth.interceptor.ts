import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Only our own API may see the access token.
 *
 * Attaching it to third-party hosts leaks the user's session to them, and it
 * also *breaks* those calls: an Authorization header makes the request
 * non-simple, so the browser preflights it, and a host that doesn't list
 * `Authorization` in Access-Control-Allow-Headers rejects it. That is exactly
 * what killed walking navigation — api.stadiamaps.com allows only
 * `Stadia-Auth, Content-Type`, so every route lookup failed CORS and surfaced
 * as "check your connection".
 *
 * Relative URLs ('/api/…') are ours too — they resolve against our own origin.
 */
function isOurApi(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return true;
  try {
    return new URL(url).origin === new URL(environment.apiUrl).origin;
  } catch {
    return false;
  }
}

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth  = inject(AuthService);
  const token = auth.token();

  // Third-party hosts (map tiles, routing, geocoding) never get the token.
  if (!isOurApi(req.url)) {
    return next(req);
  }

  // Don't attach token to the refresh endpoint to avoid loops
  if (req.url.includes('/auth/refresh')) {
    return next(req);
  }

  const request = token ? addToken(req, token) : req;

  return next(request).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isRefreshing) {
        isRefreshing = true;

        return auth.refreshAccessToken().pipe(
          switchMap(res => {
            isRefreshing = false;
            return next(addToken(req, res.accessToken));
          }),
          catchError(refreshError => {
            isRefreshing = false;
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
