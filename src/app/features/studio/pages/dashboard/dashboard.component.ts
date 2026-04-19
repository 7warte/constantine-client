import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';

interface DashboardStats {
  total_tours: number;
  published_tours: number;
  total_earnings: number;
  pending_jobs: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly stats       = signal<DashboardStats | null>(null);
  readonly recentTours = signal<any[]>([]);
  readonly loading     = signal(true);

  readonly publishedPct = computed(() => {
    const s = this.stats();
    if (!s || s.total_tours === 0) return 0;
    return Math.round((s.published_tours / s.total_tours) * 100);
  });

  ngOnInit(): void {
    this.api.get<DashboardStats>('/studio/stats').subscribe({
      next: (s) => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });

    this.api.get<any[]>('/studio/tours', { per_page: 5, sort: 'recent' }).subscribe({
      next: (tours) => this.recentTours.set(tours),
    });
  }
}
