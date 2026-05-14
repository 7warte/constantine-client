import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { AdminApiService } from '../../admin-api.service';

interface Metric { value: number; prev: number; }
interface Stats {
  pageviews: Metric;
  visitors:  Metric;
  visits:    Metric;
  bounces:   Metric;
  totaltime: Metric;
}
interface MetricRow { x: string; y: number; }

type Range = '24h' | '7d' | '30d' | '90d';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-analytics.component.html',
  styleUrl: './admin-analytics.component.scss',
})
export class AdminAnalyticsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading   = signal(true);
  readonly error     = signal<string | null>(null);
  readonly range     = signal<Range>('30d');
  readonly stats     = signal<Stats | null>(null);
  readonly topUrls   = signal<MetricRow[]>([]);
  readonly topRef    = signal<MetricRow[]>([]);
  readonly topCty    = signal<MetricRow[]>([]);

  ngOnInit(): void { this.reload(); }

  setRange(r: Range): void {
    if (r === this.range()) return;
    this.range.set(r);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);

    const end = Date.now();
    const start = end - this.rangeMs(this.range());

    forkJoin({
      stats:    this.api.get<Stats>('/analytics/stats',   { startAt: start, endAt: end }),
      urls:     this.api.get<MetricRow[]>('/analytics/metrics', { type: 'url',      startAt: start, endAt: end, limit: 10 }),
      ref:      this.api.get<MetricRow[]>('/analytics/metrics', { type: 'referrer', startAt: start, endAt: end, limit: 10 }),
      country:  this.api.get<MetricRow[]>('/analytics/metrics', { type: 'country',  startAt: start, endAt: end, limit: 10 }),
    }).subscribe({
      next: (r) => {
        this.stats.set(r.stats);
        this.topUrls.set(r.urls ?? []);
        this.topRef.set(r.ref ?? []);
        this.topCty.set(r.country ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.error ?? 'Failed to load. Check UMAMI_API_KEY + UMAMI_WEBSITE_ID on the server.');
        this.loading.set(false);
      },
    });
  }

  delta(m: Metric): { sign: 1 | -1 | 0; pct: number } {
    if (!m || !m.prev) return { sign: m?.value ? 1 : 0, pct: m?.value ?? 0 };
    const diff = m.value - m.prev;
    return {
      sign: diff > 0 ? 1 : diff < 0 ? -1 : 0,
      pct: Math.round((Math.abs(diff) / m.prev) * 100),
    };
  }

  fmtTime(seconds: number): string {
    if (!seconds || seconds < 1) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  }

  fmtAvgTime(s: Stats | null): string {
    if (!s || !s.visits?.value) return '—';
    const avgSec = s.totaltime.value / s.visits.value;
    return this.fmtTime(avgSec);
  }

  bounceRate(s: Stats | null): string {
    if (!s || !s.visits?.value) return '—';
    return `${Math.round((s.bounces.value / s.visits.value) * 100)}%`;
  }

  rangeLabel(): string {
    switch (this.range()) {
      case '24h': return 'last 24 hours';
      case '7d':  return 'last 7 days';
      case '30d': return 'last 30 days';
      case '90d': return 'last 90 days';
    }
  }

  private rangeMs(r: Range): number {
    const day = 24 * 60 * 60 * 1000;
    switch (r) {
      case '24h': return day;
      case '7d':  return 7 * day;
      case '30d': return 30 * day;
      case '90d': return 90 * day;
    }
  }
}
