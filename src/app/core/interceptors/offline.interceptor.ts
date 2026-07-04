import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, catchError, throwError } from 'rxjs';
import { OfflineService } from '../offline/offline.service';

/**
 * When a GET request fails (offline) and we have a cached copy of that exact URL
 * from a downloaded tour, serve it instead. Transparent to every component.
 */
export const offlineInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);
  const offline = inject(OfflineService);

  return next(req).pipe(
    catchError((err) => {
      const cached = offline.getJson(req.urlWithParams);
      if (cached != null) {
        return of(new HttpResponse({ status: 200, url: req.url, body: cached }));
      }
      return throwError(() => err);
    }),
  );
};
