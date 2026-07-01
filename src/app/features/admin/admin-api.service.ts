import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Thin wrapper that adds `withCredentials: true` so the admin cookie is sent on every call. */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/admin`;

  get<T>(path: string, params?: Record<string, any>): Observable<T> {
    return this.http.get<T>(`${this.base}${path}`, {
      withCredentials: true,
      params: toHttpParams(params),
    });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body, { withCredentials: true });
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body, { withCredentials: true });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body, { withCredentials: true });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`, { withCredentials: true });
  }

  /** DELETE with a JSON request body (e.g. removing one item by id). */
  deleteBody<T>(path: string, body: unknown): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`, { withCredentials: true, body });
  }

  /**
   * Multipart upload. Passes the FormData through untouched so the browser sets
   * the correct multipart Content-Type (with boundary); auth still rides the
   * admin cookie via withCredentials.
   */
  upload<T>(path: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, formData, { withCredentials: true });
  }

  /** Build a fully-qualified URL — useful for opening downloads / iframes. */
  url(path: string): string {
    return `${this.base}${path}`;
  }
}

function toHttpParams(params?: Record<string, any>): HttpParams | undefined {
  if (!params) return undefined;
  let p = new HttpParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue;
    p = p.set(k, String(v));
  }
  return p;
}
