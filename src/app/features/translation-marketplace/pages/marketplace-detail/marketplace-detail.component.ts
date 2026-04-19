import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';

@Component({
  selector: 'app-marketplace-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './marketplace-detail.component.html',
  styleUrl: './marketplace-detail.component.scss',
})
export class MarketplaceDetailComponent implements OnInit {
  private readonly api   = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb    = inject(FormBuilder);
  readonly auth          = inject(AuthService);

  readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  readonly request   = signal<any | null>(null);
  readonly loading   = signal(true);
  readonly applying  = signal(false);
  readonly applied   = signal(false);
  readonly error     = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    message: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    this.api.get<any>(`/translation-requests/${this.requestId}`).subscribe({
      next:  r  => { this.request.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  apply(): void {
    this.applying.set(true);
    this.error.set(null);
    this.api.post(`/translation-requests/${this.requestId}/apply`, this.form.getRawValue()).subscribe({
      next:  () => { this.applied.set(true); this.applying.set(false); },
      error: err => {
        this.error.set(err.error?.error ?? 'Application failed.');
        this.applying.set(false);
      },
    });
  }
}
