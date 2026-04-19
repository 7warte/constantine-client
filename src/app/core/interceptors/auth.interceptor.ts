import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;

function addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth  = inject(AuthService);
  const token = auth.token();

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
