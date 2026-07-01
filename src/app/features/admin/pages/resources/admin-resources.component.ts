import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../admin-api.service';

interface CloudinaryUsage {
  plan: string | null;
  storage_bytes: number | null;
  storage_limit: number | null;
  bandwidth_bytes: number | null;
  bandwidth_limit: number | null;
  requests: number | null;
  transformations: number | null;
  credits_used: number | null;
  credits_limit: number | null;
  date_requested: string | null;
}

interface EmailUsage {
  sent_today: number;
  sent_30d: number;
  failed_30d: number;
  free_daily: number;
  free_monthly: number;
}

interface DatabaseUsage {
  size_bytes: number;
  soft_limit_bytes: number;
}

interface Resources {
  cloudinary: CloudinaryUsage | null;
  email: EmailUsage | null;
  database: DatabaseUsage | null;
}

type UsageStatus = 'ok' | 'warn' | 'danger';

@Component({
  selector: 'app-admin-resources',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-resources.component.html',
  styleUrl: './admin-resources.component.scss',
})
export class AdminResourcesComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly data    = signal<Resources | null>(null);
  readonly error   = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<Resources>('/resources').subscribe({
      next: (d)  => { this.data.set(d);  this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  fmtBytes(bytes: number | null): string {
    if (bytes == null) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let n = bytes;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(1)} ${units[i]}`;
  }

  pctOf(used: number | null, limit: number | null): number | null {
    if (used == null || !limit) return null;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  /** Traffic-light status from a used/limit ratio: green <70%, amber 70–90%, red >90%. */
  statusOf(used: number | null, limit: number | null): UsageStatus {
    const pct = this.pctOf(used, limit);
    if (pct == null) return 'ok';
    if (pct > 90) return 'danger';
    if (pct >= 70) return 'warn';
    return 'ok';
  }
}
