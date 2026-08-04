import { ChangeDetectionStrategy, Component, Input, OnInit, OnDestroy, AfterViewChecked, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { ReportButtonComponent } from '../../shared/components/report-button/report-button.component';
import { VenueAreaMapComponent } from '../../shared/components/venue-area-map/venue-area-map.component';

@Component({
  selector: 'app-tour-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule, ButtonComponent, StarRatingComponent, ReportButtonComponent, VenueAreaMapComponent],
  templateUrl: './tour-detail.component.html',
  styleUrl: './tour-detail.component.scss',
})
export class TourDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly api    = inject(ApiService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth           = inject(AuthService);

  // Embedded mode: rendered inside another page (e.g. the library details modal)
  // rather than as a routed page. When embedded, ids come from inputs and the
  // hero CTA / report footer are hidden (the host supplies its own actions).
  @Input() embedded = false;
  @Input() embeddedVariantId?: string;
  @Input() embeddedTourId?: string;

  variantId = '';
  private tourId = '';

  readonly variant    = signal<any | null>(null);
  readonly reviews    = signal<any[]>([]);
  readonly loading    = signal(true);
  readonly owned      = signal(false);
  // Owned but removed from the library (hidden): offer a free "Add to library".
  readonly removed    = signal(false);
  readonly purchaseId = signal<string | null>(null);
  readonly acquiring  = signal(false);
  readonly error           = signal<string | null>(null);
  readonly previewPlaying  = signal(false);
  readonly previewProgress = signal(0);
  readonly previewTime     = signal(0);

  // ── Review sorting ──────────────────────────────────────────────
  readonly reviewSort = signal<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

  // ── Review form state ───────────────────────────────────────────
  readonly hasReviewed      = signal(false);
  readonly reviewRating     = signal(0);
  readonly reviewBody       = signal('');
  readonly reviewError      = signal<string | null>(null);
  readonly submittingReview = signal(false);
  readonly showReviewForm   = signal(false);

  readonly MIN_BODY_LENGTH = 20;
  readonly bodyRequired = computed(() => this.reviewRating() > 0 && this.reviewRating() <= 3);

  private readonly MAX_PREVIEW_SECONDS = 30;

  ngOnInit(): void {
    this.variantId = this.embeddedVariantId ?? this.route.snapshot.paramMap.get('variantId') ?? '';
    this.tourId    = this.embeddedTourId    ?? this.route.snapshot.queryParamMap.get('tourId') ?? '';

    this.api.get<any>(`/tours/${this.tourId}/variants/${this.variantId}`).subscribe({
      next: v => {
        this.variant.set(v);
        this.loading.set(false);
        this.loadReviews();

        if (this.auth.isLoggedIn()) {
          this.api.get<any[]>('/purchases', { include_hidden: 1 }).subscribe(purchases => {
            const match = purchases.find((p: any) => p.tour_variant_id === this.variantId);
            if (match) {
              this.purchaseId.set(match.id);
              if (match.hidden) this.removed.set(true);
              else this.owned.set(true);
            }
          });
        }
      },
      error: () => this.loading.set(false),
    });
  }

  loadReviews(): void {
    this.api.get<any[]>(
      `/tours/${this.tourId}/variants/${this.variantId}/reviews`,
      { sort: this.reviewSort() }
    ).subscribe(r => {
      this.reviews.set(r);
      // Check if current user already reviewed
      if (this.auth.isLoggedIn() && this.auth.user()) {
        const username = this.auth.user()!.username;
        this.hasReviewed.set(r.some(rev => rev.reviewer_username === username));
      }
    });
  }

  changeReviewSort(sort: 'newest' | 'oldest' | 'highest' | 'lowest'): void {
    this.reviewSort.set(sort);
    this.loadReviews();
  }

  acquire(): void {
    const v = this.variant();
    if (!v) return;

    // A removed (hidden) purchase — or a free tour — is added directly. The
    // backend restores a hidden purchase for free, whatever its price.
    if (this.removed() || v.price_cents === 0) {
      this.acquiring.set(true);
      this.api.post<any>('/purchases', { variant_id: this.variantId }).subscribe({
        next: (res) => {
          this.owned.set(true);
          this.removed.set(false);
          this.purchaseId.set(res.purchase?.id ?? this.purchaseId());
          this.acquiring.set(false);
        },
        error: (err) => {
          this.error.set(err.error?.error ?? 'Failed to get tour.');
          this.acquiring.set(false);
        },
      });
    } else {
      this.router.navigate(['/checkout', this.variantId], { queryParams: { tourId: this.tourId } });
    }
  }

  // ── Review submission ───────────────────────────────────────────

  onReviewRatingChange(rating: number): void {
    this.reviewRating.set(rating);
    this.reviewError.set(null);
  }

  submitReview(): void {
    const rating = this.reviewRating();
    const body = this.reviewBody().trim();

    if (rating === 0) {
      this.reviewError.set('Please select a star rating.');
      return;
    }
    if (rating <= 3 && body.length < this.MIN_BODY_LENGTH) {
      this.reviewError.set(`Ratings of 3 stars or below require a comment (at least ${this.MIN_BODY_LENGTH} characters).`);
      return;
    }

    this.submittingReview.set(true);
    this.reviewError.set(null);

    this.api.post<any>(`/tours/${this.tourId}/variants/${this.variantId}/reviews`, {
      rating,
      body: body || null,
    }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.showReviewForm.set(false);
        this.hasReviewed.set(true);
        this.reviewRating.set(0);
        this.reviewBody.set('');
        this.loadReviews();
      },
      error: (err) => {
        this.reviewError.set(err.error?.error ?? 'Failed to submit review.');
        this.submittingReview.set(false);
      },
    });
  }

  // ── Map animation ──────────────────────────────────────────────
  readonly mapVisible = signal(false);
  @ViewChild('tourMapEl') tourMapEl!: ElementRef<HTMLElement>;
  private mapObserver: IntersectionObserver | null = null;
  private mapObserverAttached = false;

  ngAfterViewChecked(): void {
    if (this.tourMapEl && !this.mapObserverAttached) {
      this.mapObserverAttached = true;
      this.mapObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            this.mapVisible.set(true);
            this.mapObserver?.disconnect();
          }
        },
        { threshold: 0.3 }
      );
      this.mapObserver.observe(this.tourMapEl.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.mapObserver?.disconnect();
  }

  // ── Map helpers ──────────────────────────────────────────────────

  getRomanNumeral(idx: number): string {
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return numerals[idx] ?? String(idx + 1);
  }

  /** True when the tour has drawn venue areas / geo → use the interactive map. */
  hasAreaMap(spaces: any[] | null | undefined): boolean {
    const v = this.variant();
    if (v?.latitude != null && v?.longitude != null) return true;
    return !!spaces?.some(s => s.polygon || (s.latitude != null && s.longitude != null));
  }

  // Stable start/finish coords for the venue-area map (computed → OnPush-safe).
  readonly startCoord = computed(() => {
    const v = this.variant();
    return v?.latitude != null && v?.longitude != null ? { lat: +v.latitude, lng: +v.longitude } : null;
  });
  readonly endCoord = computed(() => {
    const v = this.variant();
    return v?.end_latitude != null && v?.end_longitude != null ? { lat: +v.end_latitude, lng: +v.end_longitude } : null;
  });

  // ── Audio preview (30s cap) ─────────────────────────────────────

  togglePreview(audio: HTMLAudioElement): void {
    if (this.previewPlaying()) {
      audio.pause();
      this.previewPlaying.set(false);
    } else {
      if (audio.currentTime >= this.MAX_PREVIEW_SECONDS) {
        audio.currentTime = 0;
      }
      audio.play();
      this.previewPlaying.set(true);
    }
  }

  onAudioTimeUpdate(audio: HTMLAudioElement): void {
    const capped = Math.min(audio.currentTime, this.MAX_PREVIEW_SECONDS);
    this.previewTime.set(capped);
    this.previewProgress.set((capped / this.MAX_PREVIEW_SECONDS) * 100);

    if (audio.currentTime >= this.MAX_PREVIEW_SECONDS) {
      audio.pause();
      this.previewPlaying.set(false);
    }
  }
}
