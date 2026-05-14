import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CaptchaComponent } from '../../shared/components/captcha/captcha.component';

@Component({
  selector: 'app-support-new',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CaptchaComponent],
  templateUrl: './support-new.component.html',
  styleUrl: './support-new.component.scss',
})
export class SupportNewComponent implements OnInit {
  private readonly http  = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  readonly token   = this.route.snapshot.paramMap.get('token') ?? '';
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  /** Info loaded from the token (email, optional subject hint). */
  readonly userEmail   = signal<string | null>(null);
  readonly subjectHint = signal<string | null>(null);

  readonly subject = signal('');
  readonly body    = signal('');
  readonly submitting = signal(false);
  readonly submitErr  = signal<string | null>(null);
  readonly done       = signal(false);

  @ViewChild(CaptchaComponent) captcha?: CaptchaComponent;

  ngOnInit(): void {
    this.http.get<{ user_email: string; subject_hint: string | null }>(
      `${environment.apiUrl}/support/invite/${this.token}`,
    ).subscribe({
      next: (d) => {
        this.userEmail.set(d.user_email);
        this.subjectHint.set(d.subject_hint);
        if (d.subject_hint) this.subject.set(d.subject_hint);
        this.loading.set(false);
      },
      error: (e: any) => {
        this.error.set(e.error?.error ?? 'This link is invalid or has expired.');
        this.loading.set(false);
      },
    });
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;
    if (!this.subject().trim() || !this.body().trim()) {
      this.submitErr.set('Subject and message are both required.');
      return;
    }
    this.submitErr.set(null);
    this.submitting.set(true);

    const captchaToken = await this.captcha?.getToken();
    if (!captchaToken) {
      this.submitting.set(false);
      this.submitErr.set('Could not verify your browser. Reload and try again.');
      return;
    }

    this.http.post(`${environment.apiUrl}/support/invite/${this.token}`, {
      subject: this.subject().trim(),
      body: this.body().trim(),
      captcha_token: captchaToken,
    }).subscribe({
      next: () => { this.submitting.set(false); this.done.set(true); },
      error: (e: any) => {
        this.submitting.set(false);
        this.submitErr.set(e.error?.error ?? 'Failed to submit. Try again.');
      },
    });
  }
}
