import { ChangeDetectionStrategy, Component, Input, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { CaptchaComponent } from '../captcha/captcha.component';

const REASONS = [
  'Inappropriate content',
  'Spam / advertising',
  'Misleading or inaccurate',
  'Copyright violation',
  'Harassment',
  'Other',
];

/**
 * <app-report-button [targetType]="'tour'" [targetId]="tour.id" />
 *
 * Renders a small unobtrusive "Report" link. Click opens a modal with reason +
 * details + captcha. Anonymous users must supply an email; logged-in users are
 * auto-attributed via JWT.
 */
@Component({
  selector: 'app-report-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CaptchaComponent],
  templateUrl: './report-button.component.html',
  styleUrl: './report-button.component.scss',
})
export class ReportButtonComponent {
  @Input({ required: true }) targetType!: 'tour' | 'user' | 'review';
  @Input({ required: true }) targetId!: string;
  /** Label shown on the trigger button. Defaults to "Report". */
  @Input() label = 'Report';

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly open       = signal(false);
  readonly reason     = signal<string>(REASONS[0]);
  readonly details    = signal<string>('');
  readonly email      = signal<string>('');
  readonly submitting = signal(false);
  readonly error      = signal<string | null>(null);
  readonly done       = signal(false);

  readonly reasons = REASONS;
  get isLoggedIn(): boolean { return this.auth.isLoggedIn(); }

  @ViewChild(CaptchaComponent) captcha?: CaptchaComponent;

  openModal(): void {
    this.error.set(null);
    this.done.set(false);
    this.open.set(true);
  }

  closeModal(): void {
    if (this.submitting()) return;
    this.open.set(false);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    this.error.set(null);

    if (!this.isLoggedIn && !this.email().trim()) {
      this.error.set('Please leave an email so we can follow up.');
      return;
    }

    this.submitting.set(true);
    const token = await this.captcha?.getToken();
    if (!token) {
      this.submitting.set(false);
      this.error.set('Captcha check failed. Reload and try again.');
      return;
    }

    const headers: Record<string, string> = {};
    const userToken = this.auth.token();
    if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

    this.http.post(`${environment.apiUrl}/reports`, {
      target_type: this.targetType,
      target_id: this.targetId,
      reason: this.reason(),
      details: this.details().trim() || null,
      reporter_email: this.isLoggedIn ? null : this.email().trim(),
      captcha_token: token,
    }, { headers }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
      },
      error: (e: any) => {
        this.submitting.set(false);
        this.error.set(e.error?.error ?? 'Failed to submit report.');
      },
    });
  }
}
