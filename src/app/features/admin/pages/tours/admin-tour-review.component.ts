import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../admin-api.service';

// ── Dossier shapes (mirror src/services/tourReview.js) ──────────────────────

export interface ReviewMedia {
  id: string;
  media_type: 'audio' | 'image' | 'video' | 'pdf';
  provider: string;
  url: string;
  duration_seconds: number | null;
  order_index: number;
  caption: string | null;
}

export interface ReviewStop {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  latitude: string | null;
  longitude: string | null;
  media: ReviewMedia[];
  audio_count: number;
  image_count: number;
  video_count: number;
  pdf_count: number;
  audio_duration_seconds: number;
  missing_audio_duration: boolean;
}

export interface ReviewSpace {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  color: string | null;
  stops: ReviewStop[];
  stop_count: number;
  audio_duration_seconds: number;
}

export interface ReviewVariant {
  id: string;
  language_code: string;
  is_original: boolean;
  status: string;
  price_cents: number;
  purchase_count: number;
  spaces: ReviewSpace[];
  ungrouped_stops: ReviewStop[];
  stop_count: number;
  audio_count: number;
  audio_duration_seconds: number;
  missing_audio_duration: boolean;
}

export interface ReviewDossier {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  status: string;
  price_cents: number;
  duration_minutes: number | null;
  setting: string | null;
  start_address: string | null;
  end_address: string | null;
  presentation_audio_url: string | null;
  category: string | null;
  creator_id: string;
  creator_username: string;
  creator_display_name: string;
  creator_email: string;
  creator_suspended_at: string | null;
  tags: string[];
  variants: ReviewVariant[];
  totals: {
    variant_count: number;
    space_count: number;
    stop_count: number;
    media_count: number;
    audio_count: number;
    audio_duration_seconds: number;
    missing_audio_duration: boolean;
    purchase_count: number;
  };
}

export interface Remark {
  id: string;
  target_type: 'tour' | 'space' | 'stop' | 'media';
  target_id: string | null;
  target_label: string | null;
  body: string;
  resolved_at: string | null;
  created_at: string;
}

interface ReviewResponse {
  tour: ReviewDossier;
  review: { id: string; status: string; submitted_at: string; reviewed_at: string | null; reviewer_note: string | null; submitted_by_name: string | null } | null;
  remarks: Remark[];
  unresolved_count: number;
  public_url: string;
}

@Component({
  selector: 'app-admin-tour-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-tour-review.component.html',
  styleUrl: './admin-tour-review.component.scss',
})
export class AdminTourReviewComponent implements OnInit {
  private readonly api    = inject(AdminApiService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly tourId = signal<string>('');
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  readonly tour      = signal<ReviewDossier | null>(null);
  readonly review    = signal<ReviewResponse['review']>(null);
  readonly remarks   = signal<Remark[]>([]);
  readonly publicUrl = signal<string>('');

  // Remark composer — opens against whatever the reviewer clicked "flag" on.
  readonly composerTarget = signal<{ type: Remark['target_type']; id: string | null; label: string | null } | null>(null);
  readonly composerBody   = signal('');
  readonly savingRemark   = signal(false);

  // Decision panel
  readonly decision      = signal<'approve' | 'changes' | null>(null);
  readonly decisionNote  = signal('');
  readonly deciding      = signal(false);
  readonly decisionError = signal<string | null>(null);

  readonly openRemarks     = computed(() => this.remarks().filter(r => !r.resolved_at));
  readonly resolvedRemarks = computed(() => this.remarks().filter(r => r.resolved_at));

  /** Remarks bucketed by the thing they point at, so each row can show its own. */
  readonly remarksByTarget = computed(() => {
    const map = new Map<string, Remark[]>();
    for (const r of this.remarks()) {
      const key = r.target_id ?? 'tour';
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return map;
  });

  ngOnInit(): void {
    this.tourId.set(this.route.snapshot.paramMap.get('id') ?? '');
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<ReviewResponse>(`/tours/${this.tourId()}`).subscribe({
      next: (res) => {
        this.tour.set(res.tour);
        this.review.set(res.review);
        this.remarks.set(res.remarks);
        this.publicUrl.set(res.public_url);
        this.loading.set(false);
      },
      error: (e: any) => {
        this.error.set(e.error?.error ?? 'Failed to load tour');
        this.loading.set(false);
      },
    });
  }

  remarksFor(targetId: string | null): Remark[] {
    return this.remarksByTarget().get(targetId ?? 'tour') ?? [];
  }

  // ── Remarks ───────────────────────────────────────────────────────────────

  flag(type: Remark['target_type'], id: string | null, label: string | null): void {
    this.composerTarget.set({ type, id, label });
    this.composerBody.set('');
  }

  cancelComposer(): void {
    this.composerTarget.set(null);
    this.composerBody.set('');
  }

  saveRemark(): void {
    const target = this.composerTarget();
    const body = this.composerBody().trim();
    if (!target || !body || this.savingRemark()) return;

    this.savingRemark.set(true);
    this.api.post<Remark>(`/tours/${this.tourId()}/remarks`, {
      target_type: target.type,
      target_id: target.id,
      target_label: target.label,
      body,
    }).subscribe({
      next: (created) => {
        this.remarks.update(rs => [...rs, created]);
        this.savingRemark.set(false);
        this.cancelComposer();
      },
      error: (e: any) => {
        this.error.set(e.error?.error ?? 'Could not save the remark');
        this.savingRemark.set(false);
      },
    });
  }

  deleteRemark(r: Remark): void {
    this.api.delete(`/tours/${this.tourId()}/remarks/${r.id}`).subscribe({
      next: () => this.remarks.update(rs => rs.filter(x => x.id !== r.id)),
      error: (e: any) => this.error.set(e.error?.error ?? 'Could not delete the remark'),
    });
  }

  /** Reviewers can re-open a point the creator ticked off without fixing. */
  toggleResolved(r: Remark): void {
    this.api.patch<Remark>(`/tours/${this.tourId()}/remarks/${r.id}`, { resolved: !r.resolved_at }).subscribe({
      next: (updated) => this.remarks.update(rs => rs.map(x => x.id === updated.id ? updated : x)),
      error: (e: any) => this.error.set(e.error?.error ?? 'Could not update the remark'),
    });
  }

  // ── Decision ──────────────────────────────────────────────────────────────

  openDecision(kind: 'approve' | 'changes'): void {
    this.decision.set(kind);
    this.decisionNote.set('');
    this.decisionError.set(null);
  }

  closeDecision(): void {
    if (this.deciding()) return;
    this.decision.set(null);
  }

  confirmDecision(): void {
    const kind = this.decision();
    if (!kind || this.deciding()) return;

    this.deciding.set(true);
    this.decisionError.set(null);
    const path = kind === 'approve' ? 'approve' : 'request-changes';

    this.api.post(`/tours/${this.tourId()}/${path}`, { note: this.decisionNote().trim() || null }).subscribe({
      next: () => {
        this.deciding.set(false);
        this.decision.set(null);
        this.router.navigate(['/admin/tours']);
      },
      error: (e: any) => {
        this.decisionError.set(e.error?.error ?? 'Could not save the decision');
        this.deciding.set(false);
      },
    });
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  /** 0 → "—", 95 → "1:35", 4210 → "1:10:10" */
  fmtDuration(seconds: number | null): string {
    if (seconds == null || seconds <= 0) return '—';
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const two = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
  }

  /** Long-form for the summary tiles: "1h 12m" */
  fmtDurationLong(seconds: number): string {
    if (!seconds) return '0m';
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  fmtPrice(cents: number): string {
    return cents === 0 ? 'Free' : `€${(cents / 100).toFixed(2)}`;
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }

  statusLabel(status: string): string {
    return status.replace('_', ' ');
  }
}
