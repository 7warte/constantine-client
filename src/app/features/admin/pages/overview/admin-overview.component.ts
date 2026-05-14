import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../admin-api.service';

interface CloudinaryUsage {
  plan: string | null;
  storage_bytes: number | null;
  storage_limit: number | null;
  bandwidth_bytes: number | null;
  bandwidth_limit: number | null;
  credits_used: number | null;
  credits_limit: number | null;
  date_requested: string | null;
}

interface Overview {
  user_count: number;
  tour_count: number;
  purchase_count: number;
  refunds_pending: number;
  revenue: { lifetime_cents: number; last_30_days_cents: number };
  tour_stats: {
    avg_price_cents: number | null;
    avg_duration_min: number | null;
    longest_min:      number | null;
    shortest_min:     number | null;
  };
  cloudinary: CloudinaryUsage | null;
}

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
})
export class AdminOverviewComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly data    = signal<Overview | null>(null);
  readonly error   = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<Overview>('/overview').subscribe({
      next: (d)  => { this.data.set(d);  this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  fmtMoney(cents: number | null): string {
    if (cents == null) return '—';
    return `€${(cents / 100).toFixed(2)}`;
  }

  fmtBytes(bytes: number | null): string {
    if (bytes == null) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(1)} ${units[i]}`;
  }

  fmtMinutes(m: number | null): string {
    if (m == null) return '—';
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  pctOf(used: number | null, limit: number | null): number | null {
    if (used == null || !limit) return null;
    return Math.min(100, Math.round((used / limit) * 100));
  }
}
