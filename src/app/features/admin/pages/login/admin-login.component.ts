import { ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaptchaComponent } from '../../../../shared/components/captcha/captcha.component';
import { AdminAuthService } from '../../admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CaptchaComponent],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly auth   = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly password   = signal('');
  readonly submitting = signal(false);
  readonly error      = signal<string | null>(null);

  @ViewChild(CaptchaComponent) captcha?: CaptchaComponent;

  async submit(): Promise<void> {
    if (this.submitting()) return;
    const pwd = this.password().trim();
    if (!pwd) { this.error.set('Password required'); return; }

    this.submitting.set(true);
    this.error.set(null);

    const token = await this.captcha?.getToken();
    if (!token) {
      this.submitting.set(false);
      this.error.set('Could not verify your browser. Reload the page and try again.');
      return;
    }

    this.auth.login(pwd, token).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigateByUrl('/admin/overview');
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.error?.error ?? 'Login failed');
      },
    });
  }
}
