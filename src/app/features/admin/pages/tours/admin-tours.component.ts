import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../admin-api.service';

export interface AdminTourRow {
  id: string;
  title: string;
  status: 'draft' | 'under_review' | 'needs_changes' | 'published' | 'archived';
  cover_image_url: string | null;
  price_cents: number;
  created_at: string;
  updated_at: string;
  creator_id: string;
  creator_username: string;
  creator_name: string;
  variant_count: number;
  stop_count: number;
  purchase_count: number;
  review_status: 'pending' | 'approved' | 'changes_requested' | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  unresolved_remarks: number;
}

interface ToursResponse {
  tours: AdminTourRow[];
  counts: Record<string, number>;
  review_enabled: boolean;
}

@Component({
  selector: 'app-admin-tours',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-tours.component.html',
  styleUrl: './admin-tours.component.scss',
})
export class AdminToursComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly rows    = signal<AdminTourRow[]>([]);
  readonly counts  = signal<Record<string, number>>({});

  readonly statusFilter = signal<string>('under_review');
  readonly search       = signal<string>('');

  // Kill switch. Off = creators publish straight to the marketplace.
  readonly reviewEnabled = signal(true);
  readonly togglingFlag  = signal(false);

  readonly filters: { value: string; label: string }[] = [
    { value: 'under_review',  label: 'Awaiting review' },
    { value: 'needs_changes', label: 'Changes requested' },
    { value: 'published',     label: 'Published' },
    { value: 'draft',         label: 'Drafts' },
    { value: 'archived',      label: 'Archived' },
    { value: '',              label: 'All' },
  ];

  readonly queueSize = computed(() => this.counts()['under_review'] ?? 0);

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<ToursResponse>('/tours', {
      status: this.statusFilter(),
      q: this.search().trim(),
    }).subscribe({
      next: (res) => {
        this.rows.set(res.tours);
        this.counts.set(res.counts ?? {});
        this.reviewEnabled.set(res.review_enabled);
        this.loading.set(false);
      },
      error: (e: any) => {
        this.error.set(e.error?.error ?? 'Failed to load tours');
        this.loading.set(false);
      },
    });
  }

  setFilter(value: string): void {
    this.statusFilter.set(value);
    this.reload();
  }

  count(status: string): number {
    if (!status) return Object.values(this.counts()).reduce((a, b) => a + b, 0);
    return this.counts()[status] ?? 0;
  }

  toggleReview(enabled: boolean): void {
    this.togglingFlag.set(true);
    this.api.put<{ enabled: boolean }>('/settings/tour-review', { enabled }).subscribe({
      next: (res) => { this.reviewEnabled.set(res.enabled); this.togglingFlag.set(false); },
      error: (e: any) => {
        this.error.set(e.error?.error ?? 'Could not change the review setting');
        this.togglingFlag.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    return status.replace('_', ' ');
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }

  /** How long the tour has been sitting in the queue. */
  waitingFor(row: AdminTourRow): string {
    if (row.status !== 'under_review' || !row.submitted_at) return '';
    const hours = Math.floor((Date.now() - new Date(row.submitted_at).getTime()) / 3_600_000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }
}
