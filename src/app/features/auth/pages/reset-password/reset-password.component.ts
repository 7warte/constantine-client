import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly fb    = inject(FormBuilder);
  private readonly api   = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly done    = signal(false);
  readonly error   = signal<string | null>(null);

  private get token(): string {
    return this.route.snapshot.paramMap.get('token') ?? '';
  }

  readonly form = this.fb.nonNullable.group({
    password:        ['', [Validators.required, Validators.minLength(8)]],
    password_confirm: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    const { password, password_confirm } = this.form.getRawValue();
    if (password !== password_confirm) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.api.post('/auth/reset-password', { token: this.token, password }).subscribe({
      next: () => {
        this.done.set(true);
        this.loading.set(false);
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Could not reset password. The link may have expired.');
        this.loading.set(false);
      },
    });
  }
}
