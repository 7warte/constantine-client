import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb  = inject(FormBuilder);
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly sent    = signal(false);
  readonly error   = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    this.api.post('/auth/forgot-password', this.form.getRawValue()).subscribe({
      next: () => {
        this.sent.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Something went wrong. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
