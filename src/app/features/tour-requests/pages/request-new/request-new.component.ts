import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';

@Component({
  selector: 'app-request-new',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './request-new.component.html',
  styleUrl: './request-new.component.scss',
})
export class RequestNewComponent {
  private readonly api    = inject(ApiService);
  private readonly fb     = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    title:       ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', Validators.maxLength(1000)],
    wishes:      ['', Validators.maxLength(500)],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    this.api.post('/tour-requests', this.form.getRawValue()).subscribe({
      next:  () => this.router.navigate(['/tour-requests']),
      error: err => {
        this.error.set(err.error?.error ?? 'Failed to submit request.');
        this.loading.set(false);
      },
    });
  }
}
