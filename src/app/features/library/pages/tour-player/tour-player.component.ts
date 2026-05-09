import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../../core/services/api.service';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating.component';

@Component({
  selector: 'app-tour-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule, StarRatingComponent, MatIconModule],
  templateUrl: './tour-player.component.html',
  styleUrl: './tour-player.component.scss',
})
export class TourPlayerComponent implements OnInit, OnDestroy {
  private readonly api   = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading          = signal(true);
  readonly variant          = signal<any | null>(null);
  readonly stops            = signal<any[]>([]);
  readonly currentStopIndex = signal(0);
  readonly started          = signal(typeof window !== 'undefined' && window.innerWidth >= 992);

  readonly purchaseId  = this.route.snapshot.paramMap.get('purchaseId') ?? '';
  readonly currentStop = computed(() => this.stops()[this.currentStopIndex()] ?? null);
  readonly isLastStop  = computed(() => this.currentStopIndex() === this.stops().length - 1);

  readonly firstSpaceName = computed(() => {
    const groups = this.groupedStops();
    if (!groups.length) return '';
    return groups[0].spaceName ?? groups[0].stops[0]?.title ?? '';
  });

  /** Stops grouped by space for sidebar display */
  readonly groupedStops = computed(() => {
    const stops = this.stops();
    const groups: { spaceId: string | null; spaceName: string | null; stops: any[] }[] = [];
    const map = new Map<string | null, any[]>();
    const nameMap = new Map<string | null, string | null>();

    for (const stop of stops) {
      const key = stop.space_id ?? null;
      if (!map.has(key)) {
        map.set(key, []);
        nameMap.set(key, stop.space_name ?? null);
      }
      map.get(key)!.push(stop);
    }

    for (const [spaceId, spaceStops] of map) {
      groups.push({ spaceId, spaceName: nameMap.get(spaceId) ?? null, stops: spaceStops });
    }
    return groups;
  });

  // ── Audio player state ─────────────────────────────────────────
  readonly isPlaying     = signal(false);
  readonly audioProgress = signal(0);
  readonly audioCurrent  = signal(0);
  readonly audioDuration = signal(0);
  private animFrameId: number | null = null;

  @ViewChild('mainAudio') mainAudioRef!: ElementRef<HTMLAudioElement>;

  togglePlay(): void {
    const audio = this.mainAudioRef?.nativeElement;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      this.isPlaying.set(true);
      this.startProgressLoop();
    } else {
      audio.pause();
      this.isPlaying.set(false);
      this.stopProgressLoop();
    }
  }

  private startProgressLoop(): void {
    const tick = () => {
      const audio = this.mainAudioRef?.nativeElement;
      if (audio && !audio.paused) {
        this.audioCurrent.set(audio.currentTime);
        this.audioDuration.set(audio.duration || 0);
        this.audioProgress.set(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
        this.animFrameId = requestAnimationFrame(tick);
      }
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopProgressLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  skip(seconds: number): void {
    const audio = this.mainAudioRef?.nativeElement;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  }

  onAudioEnded(): void {
    this.isPlaying.set(false);
    this.stopProgressLoop();
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Map modal ──────────────────────────────────────────────────
  readonly showMapModal = signal(false);
  readonly mapSpaces    = signal<any[]>([]);

  @ViewChild('mapFrame') mapFrameRef!: ElementRef<HTMLElement>;

  openMap(): void {
    this.showMapModal.set(true);
    // Auto-scroll to active space on mobile
    setTimeout(() => {
      const frame = this.mapFrameRef?.nativeElement;
      const stop = this.currentStop();
      if (!frame || !stop?.space_id) return;
      const space = this.mapSpaces().find(s => s.id === stop.space_id);
      if (!space?.map_x || !space?.map_y) return;
      const scrollX = (space.map_x / 100) * frame.scrollWidth - frame.clientWidth / 2;
      const scrollY = (space.map_y / 100) * frame.scrollHeight - frame.clientHeight / 2;
      frame.scrollTo({ left: Math.max(0, scrollX), top: Math.max(0, scrollY), behavior: 'smooth' });
    }, 100);
  }

  getRomanNumeral(idx: number): string {
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return numerals[idx] ?? String(idx + 1);
  }

  // ── Image modal ───────────────────────────────────────────────
  readonly modalImages    = signal<any[]>([]);
  readonly modalImageIdx  = signal(0);

  getImages(stop: any): any[] {
    return (stop?.media ?? []).filter((m: any) => m.media_type === 'image');
  }

  getAudio(stop: any): any | null {
    return (stop?.media ?? []).find((m: any) => m.media_type === 'audio') ?? null;
  }

  getPdfs(stop: any): any[] {
    return (stop?.media ?? []).filter((m: any) => m.media_type === 'pdf');
  }

  openImageModal(images: any[], startIdx: number): void {
    this.modalImages.set(images);
    this.modalImageIdx.set(startIdx);
  }

  closeImageModal(): void {
    this.modalImages.set([]);
  }

  prevImage(): void {
    this.modalImageIdx.update(i => (i > 0 ? i - 1 : this.modalImages().length - 1));
  }

  nextImage(): void {
    this.modalImageIdx.update(i => (i < this.modalImages().length - 1 ? i + 1 : 0));
  }

  // ── Review state ──────────────────────────────────────────────
  readonly showReview     = signal(false);
  readonly reviewRating   = signal(0);
  readonly reviewBody     = signal('');
  readonly reviewError    = signal<string | null>(null);
  readonly submittingReview = signal(false);
  readonly reviewSubmitted  = signal(false);
  readonly existingReview   = signal<any | null>(null);

  readonly MIN_BODY_LENGTH = 20;
  readonly bodyRequired = computed(() => this.reviewRating() > 0 && this.reviewRating() <= 3);
  readonly bodyTooShort = computed(() =>
    this.bodyRequired() && this.reviewBody().trim().length > 0 && this.reviewBody().trim().length < this.MIN_BODY_LENGTH
  );

  ngOnInit(): void {
    this.api.get<any>(`/purchases/${this.purchaseId}`).subscribe({
      next: (purchase) => {
        this.variant.set(purchase);
        const { tour_id, tour_variant_id } = purchase;
        this.api.get<any[]>(`/tours/${tour_id}/variants/${tour_variant_id}/stops`).subscribe({
          next: (stops) => { this.stops.set(stops); this.loading.set(false); },
          error: ()      => this.loading.set(false),
        });

        // Load full variant detail (start_address, tour_title, spaces, etc.)
        this.api.get<any>(`/tours/${tour_id}/variants/${tour_variant_id}`).subscribe(detail => {
          this.variant.update(v => ({ ...v, ...detail }));
          if (detail.spaces) this.mapSpaces.set(detail.spaces);
        });

        // Check if user already reviewed
        this.api.get<any[]>(`/tours/${tour_id}/variants/${tour_variant_id}/reviews`).subscribe(reviews => {
          // The API doesn't filter by user, so we need to check via the purchases endpoint or just try to submit
          // We'll handle the 409 conflict on submit instead
        });
      },
      error: () => this.loading.set(false),
    });
  }

  goToStop(idx: number): void {
    if (idx < 0 || idx >= this.stops().length) return;
    this.currentStopIndex.set(idx);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startTour(): void {
    this.started.set(true);
    window.scrollTo({ top: 0 });
  }

  // ── Compass to next stop ───────────────────────────────────────────────
  readonly compassOpen                = signal(false);
  readonly userPosition               = signal<{ lat: number; lng: number } | null>(null);
  readonly userHeading                = signal<number | null>(null);
  readonly compassError               = signal<string | null>(null);
  readonly needsOrientationPermission = signal(false);

  private geoWatchId: number | null = null;
  private orientationListener: ((e: any) => void) | null = null;

  readonly nextStop = computed(() => this.stops()[this.currentStopIndex() + 1] ?? null);

  readonly canShowCompass = computed(() => {
    const next = this.nextStop();
    return !!(next && next.latitude != null && next.longitude != null);
  });

  readonly distanceMeters = computed<number | null>(() => {
    const pos = this.userPosition();
    const next = this.nextStop();
    if (!pos || !next?.latitude) return null;
    return haversineKm(pos.lat, pos.lng, +next.latitude, +next.longitude) * 1000;
  });

  readonly bearingDegrees = computed<number | null>(() => {
    const pos = this.userPosition();
    const next = this.nextStop();
    if (!pos || !next?.latitude) return null;
    return bearingDeg(pos.lat, pos.lng, +next.latitude, +next.longitude);
  });

  readonly arrowAngle = computed<number>(() => {
    const b = this.bearingDegrees();
    const h = this.userHeading();
    if (b == null) return 0;
    if (h == null) return b;
    return ((b - h) + 360) % 360;
  });

  openCompass(): void {
    this.compassOpen.set(true);
    this.userPosition.set(null);
    this.userHeading.set(null);
    this.compassError.set(null);
    this.needsOrientationPermission.set(false);

    if (!('geolocation' in navigator)) {
      this.compassError.set('Geolocation is not supported on this device.');
      return;
    }
    this.geoWatchId = navigator.geolocation.watchPosition(
      (pos) => this.userPosition.set({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Location permission denied.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Location unavailable.'
            : err.code === err.TIMEOUT
              ? 'Location request timed out.'
              : 'Could not determine your location.';
        this.compassError.set(msg);
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );

    const reqPermFn = (DeviceOrientationEvent as any)?.requestPermission;
    if (typeof reqPermFn === 'function') {
      // iOS 13+ — needs a user-gesture-driven permission button
      this.needsOrientationPermission.set(true);
    } else {
      this.attachOrientationListener();
    }
  }

  requestOrientationPermission(): void {
    const reqPermFn = (DeviceOrientationEvent as any).requestPermission;
    reqPermFn().then((res: string) => {
      if (res === 'granted') {
        this.needsOrientationPermission.set(false);
        this.attachOrientationListener();
      } else {
        this.compassError.set('Compass permission denied. The arrow will point at absolute bearing instead.');
        this.needsOrientationPermission.set(false);
      }
    }).catch(() => {
      this.needsOrientationPermission.set(false);
    });
  }

  private attachOrientationListener(): void {
    this.orientationListener = (e: any) => {
      let heading: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') {
        heading = e.webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        heading = (360 - e.alpha) % 360;
      }
      this.userHeading.set(heading);
    };
    window.addEventListener('deviceorientationabsolute', this.orientationListener as any, true);
    window.addEventListener('deviceorientation', this.orientationListener as any, true);
  }

  closeCompass(): void {
    this.compassOpen.set(false);
    if (this.geoWatchId != null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
    if (this.orientationListener) {
      window.removeEventListener('deviceorientationabsolute', this.orientationListener as any, true);
      window.removeEventListener('deviceorientation', this.orientationListener as any, true);
      this.orientationListener = null;
    }
  }

  formatDistance(meters: number | null): string {
    if (meters == null) return '—';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  }

  ngOnDestroy(): void {
    this.closeCompass();
  }

  next(): void { this.goToStop(this.currentStopIndex() + 1); }
  prev(): void { this.goToStop(this.currentStopIndex() - 1); }

  finishTour(): void {
    this.showReview.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onRatingChange(rating: number): void {
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

    const v = this.variant();
    this.api.post<any>(`/tours/${v.tour_id}/variants/${v.tour_variant_id}/reviews`, {
      rating,
      body: body || null,
    }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.reviewSubmitted.set(true);
      },
      error: (err) => {
        this.reviewError.set(err.error?.error ?? 'Failed to submit review.');
        this.submittingReview.set(false);
      },
    });
  }

  skipReview(): void {
    this.reviewSubmitted.set(true);
  }
}

// ── Geo helpers ───────────────────────────────────────────────────────────────
function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dLambda = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
