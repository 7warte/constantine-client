import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * App → web sign-in handoff. The mobile app opens this page with a one-time
 * token (`?t=`) and a destination (`?redirect=`). We exchange the token for a
 * real session, then continue to the destination — so users coming from the app
 * don't have to sign in again on the website.
 */
@Component({
  selector: 'app-handoff',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="handoff-page">
      @if (error()) {
        <h1>Couldn't sign you in</h1>
        <p class="text-secondary">{{ error() }}</p>
        <a routerLink="/auth/login" class="btn btn--primary">Sign in</a>
      } @else {
        <p class="text-secondary">Signing you in…</p>
      }
    </div>
  `,
  styles: [
    `.handoff-page { max-width: 420px; margin: 4rem auto; text-align: center; padding: 0 1rem; }`,
  ],
})
export class HandoffComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('t') ?? '';
    const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/';
    if (!token) {
      this.error.set('Missing sign-in token.');
      return;
    }
    this.auth.exchangeHandoff(token).subscribe({
      next: () => this.router.navigateByUrl(this.safeRedirect(redirect)),
      error: (err) =>
        this.error.set(err?.error?.error ?? 'This sign-in link has expired. Please sign in.'),
    });
  }

  /** Only allow internal redirects (prevents open-redirect abuse). */
  private safeRedirect(path: string): string {
    return path.startsWith('/') && !path.startsWith('//') ? path : '/';
  }
}
