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

interface MapsHealth {
  ok: boolean;
  state: 'healthy' | 'quota_exhausted' | 'auth_failed' | 'error' | 'unreachable';
  hint: string;
  status: number | null;
  referer: string;
  checked_at: string;
}

interface Resources {
  cloudinary: CloudinaryUsage | null;
  email: EmailUsage | null;
  database: DatabaseUsage | null;
  maps: MapsHealth | null;
}

type UsageStatus = 'ok' | 'warn' | 'danger';

// ── TEMPORARY: development content reset ───────────────────────────────────
// Delete these types, the state below and the matching template block once the
// platform is live (along with the API's /admin/dev/content-reset endpoints).

interface ResetCounts {
  tours: number;
  variants: number;
  venues: number;
  stops: number;
  media: number;
  purchases: number;
  reviews: number;
  translation_requests: number;
  tour_requests: number;
  payouts: number;
  users_kept: number;
}

interface ResetPreview {
  enabled: boolean;
  confirm_phrase: string;
  folders: string[];
  counts: ResetCounts;
}

interface ResetResult {
  ok: boolean;
  deleted: ResetCounts;
  cloudinary: { deleted: number; folders: Record<string, number>; errors: string[] };
  mux?: { deleted: number; skipped?: string; error?: string };
  remaining: ResetCounts;
}

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

  // ── TEMPORARY: development content reset ─────────────────────────────────
  readonly reset       = signal<ResetPreview | null>(null);
  readonly confirmText = signal('');
  readonly resetting   = signal(false);
  readonly resetError  = signal<string | null>(null);
  readonly resetResult = signal<ResetResult | null>(null);

  ngOnInit(): void {
    this.api.get<Resources>('/resources').subscribe({
      next: (d)  => { this.data.set(d);  this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });

    this.loadResetPreview();
  }

  private loadResetPreview(): void {
    this.api.get<ResetPreview>('/dev/content-reset').subscribe({
      next: (r) => this.reset.set(r),
      // The endpoint is temporary — if it's gone, just hide the card.
      error: () => this.reset.set(null),
    });
  }

  runReset(): void {
    const preview = this.reset();
    if (!preview || this.resetting()) return;
    if (this.confirmText() !== preview.confirm_phrase) return;

    this.resetting.set(true);
    this.resetError.set(null);

    this.api.post<ResetResult>('/dev/content-reset', { confirm: this.confirmText() }).subscribe({
      next: (res) => {
        this.resetting.set(false);
        this.resetResult.set(res);
        this.confirmText.set('');
        // Refresh the counts so the card reflects the now-empty database.
        this.loadResetPreview();
      },
      error: (e) => {
        this.resetting.set(false);
        this.resetError.set(e.error?.error ?? 'Reset failed');
      },
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
