import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';

interface JobsEarningsSummary {
  total_completed_jobs: number;
  total_earned: number;
  pending_payment: number;
}

@Component({
  selector: 'app-jobs-earnings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CommonModule],
  templateUrl: './jobs-earnings.component.html',
  styleUrl: './jobs-earnings.component.scss',
})
export class JobsEarningsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly summary  = signal<JobsEarningsSummary | null>(null);
  readonly payments = signal<any[]>([]);
  readonly loading  = signal(true);

  ngOnInit(): void {
    this.api.get<JobsEarningsSummary>('/jobs/earnings/summary').subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });

    this.api.get<any[]>('/jobs/earnings/payments').subscribe({
      next: (p) => this.payments.set(p),
    });
  }
}
