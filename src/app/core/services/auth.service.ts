import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface PublicUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

const TOKEN_KEY = 'constantine_token';
const REFRESH_KEY = 'constantine_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api    = inject(ApiService);
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user  = signal<PublicUser | null>(null);
  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly user        = this._user.asReadonly();
  readonly token       = this._token.asReadonly();
  readonly isLoggedIn  = computed(() => this._token() !== null);

  /** Call once on app init to restore user data from a stored token. */
  init(): void {
    if (this._token()) {
      this.api.get<PublicUser>('/users/me').subscribe({
        next:  u => this._user.set(u),
        error: () => this.logout(),   // token expired or invalid
      });
    }
  }

  register(body: { email: string; username: string; display_name: string; password: string }) {
    return this.api.post<AuthResponse>('/auth/register', body).pipe(
      tap(res => this.saveSession(res))
    );
  }

  login(body: { email: string; password: string }) {
    return this.api.post<AuthResponse>('/auth/login', body).pipe(
      tap(res => this.saveSession(res))
    );
  }

  logout(redirect = true): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this._token.set(null);
    this._user.set(null);
    if (redirect) {
      // Only redirect if on a protected route
      const url = this.router.url;
      const publicPaths = ['/', '/explore', '/tours', '/creators', '/translation-marketplace', '/auth'];
      const isPublic = publicPaths.some(p => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'));
      if (!isPublic) {
        this.router.navigate(['/']);
      }
    }
  }

  /** Try to get a new access token using the stored refresh token. */
  refreshAccessToken(): Observable<{ accessToken: string }> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }

    return this.http
      .post<{ accessToken: string }>(`${environment.apiUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap(res => {
          localStorage.setItem(TOKEN_KEY, res.accessToken);
          this._token.set(res.accessToken);
        }),
        catchError(err => {
          this.logout();
          return throwError(() => err);
        }),
      );
  }

  updateUser(user: PublicUser): void {
    this._user.set(user);
  }

  private saveSession(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_KEY, res.refreshToken);
    this._token.set(res.accessToken);
    this._user.set(res.user);
  }
}
