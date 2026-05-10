import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, tap, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * AdminAuthService — manages the admin session.
 *
 * The session lives in an httpOnly cookie set by the backend, so we don't
 * store the token client-side. We only track an in-memory boolean reflecting
 * whether the last `verifySession()` call succeeded.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  private readonly _isLoggedIn = signal(false);
  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  fetchAltchaChallenge(): Observable<unknown> {
    return this.http.get(`${this.base}/altcha-challenge`, { withCredentials: true });
  }

  login(password: string, altcha: string): Observable<{ ok: true; expires_in: number }> {
    return this.http.post<{ ok: true; expires_in: number }>(
      `${this.base}/login`,
      { password, altcha },
      { withCredentials: true },
    ).pipe(tap(() => this._isLoggedIn.set(true)));
  }

  logout(): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${this.base}/logout`,
      {},
      { withCredentials: true },
    ).pipe(tap(() => this._isLoggedIn.set(false)));
  }

  /** Check whether the admin_token cookie is still valid. */
  verifySession(): Observable<boolean> {
    return this.http.get<{ ok: true }>(`${this.base}/session`, { withCredentials: true }).pipe(
      map(() => { this._isLoggedIn.set(true); return true; }),
      catchError(() => { this._isLoggedIn.set(false); return of(false); }),
    );
  }
}
