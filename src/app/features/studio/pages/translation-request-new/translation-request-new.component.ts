import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';

@Component({
  selector: 'app-translation-request-new',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './translation-request-new.component.html',
  styleUrl: './translation-request-new.component.scss',
})
export class TranslationRequestNewComponent implements OnInit {
  private readonly api    = inject(ApiService);
  private readonly fb     = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly tours    = signal<any[]>([]);
  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    tour_id:              ['', Validators.required],
    target_language_code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(10)]],
    description:          ['', Validators.maxLength(500)],
    compensation_type:    ['fixed' as 'fixed' | 'percentage', Validators.required],
    compensation_value:   [0, [Validators.required, Validators.min(0)]],
    visibility:           ['public' as 'public' | 'direct', Validators.required],
    target_user_id:       [''],
  });

  ngOnInit(): void {
    this.api.get<any[]>('/studio/tours').subscribe(t => this.tours.set(t));
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const body = { ...this.form.getRawValue() };
    if (body.visibility === 'public') delete (body as any).target_user_id;

    this.api.post('/studio/translation-requests', body).subscribe({
      next:  () => this.router.navigate(['/studio']),
      error: err => {
        this.error.set(err.error?.error ?? 'Failed to post request.');
        this.loading.set(false);
      },
    });
  }
}
