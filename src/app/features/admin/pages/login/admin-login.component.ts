import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { AdminAuthService } from '../../admin-auth.service';
import 'altcha';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly auth   = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly password      = signal('');
  readonly altchaPayload = signal<string | null>(null);
  readonly submitting    = signal(false);
  readonly error         = signal<string | null>(null);

  readonly challengeUrl = `${environment.apiUrl}/admin/altcha-challenge`;

  onAltchaStateChange(event: Event): void {
    const detail = (event as CustomEvent).detail;
    if (detail?.state === 'verified' && typeof detail?.payload === 'string') {
      this.altchaPayload.set(detail.payload);
    } else {
      this.altchaPayload.set(null);
    }
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    const pwd = this.password().trim();
    if (!pwd) { this.error.set('Password required'); return; }

    this.submitting.set(true);
    this.error.set(null);

    // Wait up to 8s for the invisible Altcha to solve. PoW is usually <500ms but
    // first-time mounts can be slower while the script warms up.
    const altcha = await this.waitForAltcha(8_000);
    if (!altcha) {
      this.submitting.set(false);
      this.error.set('Could not verify your browser. Reload the page and try again.');
      return;
    }

    this.auth.login(pwd, altcha).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/admin/overview');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.error ?? 'Login failed');
        // Challenges are single-use; clear so the widget will fetch a new one on retry.
        this.altchaPayload.set(null);
      },
    });
  }

  private waitForAltcha(timeoutMs: number): Promise<string | null> {
    return new Promise(resolve => {
      const start = Date.now();
      const tick = () => {
        const v = this.altchaPayload();
        if (v) return resolve(v);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, 100);
      };
      tick();
    });
  }
}
