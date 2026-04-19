import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-request-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent],
  templateUrl: './request-detail.component.html',
  styleUrl: './request-detail.component.scss',
})
export class RequestDetailComponent implements OnInit {
  private readonly api   = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb    = inject(FormBuilder);
  readonly auth          = inject(AuthService);

  readonly requestId  = this.route.snapshot.paramMap.get('requestId') ?? '';
  readonly request    = signal<any | null>(null);
  readonly loading    = signal(true);
  readonly myTours    = signal<any[]>([]);
  readonly fulfilling = signal(false);
  readonly fulfilled  = signal(false);
  readonly error      = signal<string | null>(null);

  readonly fulfillForm = this.fb.nonNullable.group({
    tour_id: ['', Validators.required],
  });

  ngOnInit(): void {
    this.api.get<any>(`/tour-requests/${this.requestId}`).subscribe({
      next:  r  => { this.request.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });

    // Load the current user's published tours for the fulfill dropdown
    if (this.auth.isLoggedIn()) {
      this.api.get<any[]>('/studio/tours').subscribe(t =>
        this.myTours.set(t.filter((tour: any) => tour.status === 'published'))
      );
    }
  }

  fulfill(): void {
    if (this.fulfillForm.invalid) return;
    this.fulfilling.set(true);
    this.error.set(null);

    this.api.post(`/tour-requests/${this.requestId}/fulfill`, this.fulfillForm.getRawValue()).subscribe({
      next: () => {
        this.fulfilled.set(true);
        this.fulfilling.set(false);
      },
      error: err => {
        this.error.set(err.error?.error ?? 'Failed to fulfill request.');
        this.fulfilling.set(false);
      },
    });
  }
}
