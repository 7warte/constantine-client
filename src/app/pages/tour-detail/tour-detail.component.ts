import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, AfterViewChecked, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';

@Component({
  selector: 'app-tour-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule, ButtonComponent, StarRatingComponent],
  templateUrl: './tour-detail.component.html',
  styleUrl: './tour-detail.component.scss',
})
export class TourDetailComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly api    = inject(ApiService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth           = inject(AuthService);

  readonly variantId = this.route.snapshot.paramMap.get('variantId') ?? '';
  private tourId = '';

  readonly variant    = signal<any | null>(null);
  readonly reviews    = signal<any[]>([]);
  readonly loading    = signal(true);
  readonly owned      = signal(false);
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
    this.tourId = this.route.snapshot.queryParamMap.get('tourId') ?? '';

    this.api.get<any>(`/tours/${this.tourId}/variants/${this.variantId}`).subscribe({
      next: v => {
        this.variant.set(v);
        this.loading.set(false);
        this.loadReviews();

        if (this.auth.isLoggedIn()) {
          this.api.get<any[]>('/purchases').subscribe(purchases => {
            const match = purchases.find((p: any) => p.tour_variant_id === this.variantId);
            if (match) {
              this.owned.set(true);
              this.purchaseId.set(match.id);
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

    if (v.price_cents === 0) {
      this.acquiring.set(true);
      this.api.post<any>('/purchases', { variant_id: this.variantId }).subscribe({
        next: (res) => {
          this.owned.set(true);
          this.purchaseId.set(res.purchase?.id ?? null);
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
