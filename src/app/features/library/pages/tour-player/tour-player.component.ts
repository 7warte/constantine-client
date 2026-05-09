import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, ElementRef, ViewChild, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-tour-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, MatExpansionModule],
  templateUrl: './tour-player.component.html',
  styleUrl: './tour-player.component.scss',
})
export class TourPlayerComponent implements OnInit, OnDestroy {
  private readonly api   = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly variant = signal<any | null>(null);
  readonly stops   = signal<any[]>([]);
  readonly started = signal(false);

  readonly expandedVenueIdx = signal<number | null>(null);
  readonly expandedStopId   = signal<string | null>(null);

  readonly purchaseId = this.route.snapshot.paramMap.get('purchaseId') ?? '';

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

  readonly firstSpaceName = computed(() => {
    const groups = this.groupedStops();
    if (!groups.length) return '';
    return groups[0].spaceName ?? groups[0].stops[0]?.title ?? '';
  });

  readonly currentSpaceId = computed(() => {
    const idx = this.expandedVenueIdx();
    if (idx == null) return null;
    return this.groupedStops()[idx]?.spaceId ?? null;
  });

  // ── Audio state (one expanded stop at a time) ────────────────────
  readonly isPlaying     = signal(false);
  readonly audioProgress = signal(0);
  readonly audioCurrent  = signal(0);
  readonly audioDuration = signal(0);

  togglePlay(audio: HTMLAudioElement): void {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  skip(audio: HTMLAudioElement, seconds: number): void {
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  }

  onTimeUpdate(audio: HTMLAudioElement): void {
    this.audioCurrent.set(audio.currentTime);
    this.audioDuration.set(audio.duration || 0);
    this.audioProgress.set(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
  }

  onAudioEnded(): void {
    this.isPlaying.set(false);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private resetAudioState(): void {
    this.isPlaying.set(false);
    this.audioProgress.set(0);
    this.audioCurrent.set(0);
    this.audioDuration.set(0);
  }

  // ── Accordion state handlers ─────────────────────────────────────
  onVenueOpen(idx: number): void {
    this.expandedVenueIdx.set(idx);
  }

  onVenueClose(idx: number): void {
    if (this.expandedVenueIdx() === idx) {
      this.expandedVenueIdx.set(null);
      this.expandedStopId.set(null);
      this.resetAudioState();
    }
  }

  onStopOpen(stopId: string): void {
    this.expandedStopId.set(stopId);
    this.resetAudioState();
  }

  onStopClose(stopId: string): void {
    if (this.expandedStopId() === stopId) {
      this.expandedStopId.set(null);
      this.resetAudioState();
    }
  }

  startTour(): void {
    this.started.set(true);
    const groups = this.groupedStops();
    if (!groups.length) return;
    this.expandedVenueIdx.set(0);
    const firstStop = groups[0].stops[0];
    if (firstStop) this.expandedStopId.set(firstStop.id);

    setTimeout(() => {
      const el = document.querySelector('.player__venue-panel');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // ── Map modal ────────────────────────────────────────────────────
  readonly showMapModal = signal(false);
  readonly mapSpaces    = signal<any[]>([]);

  @ViewChild('mapFrame') mapFrameRef?: ElementRef<HTMLElement>;

  openMap(): void {
    this.showMapModal.set(true);
    // After the modal renders, scroll the active dot into the centre of the frame.
    setTimeout(() => {
      const frame = this.mapFrameRef?.nativeElement;
      const activeId = this.currentSpaceId();
      if (!frame || !activeId) return;
      const space = this.mapSpaces().find(s => s.id === activeId);
      if (space?.map_x == null || space?.map_y == null) return;
      const targetX = (space.map_x / 100) * frame.scrollWidth - frame.clientWidth / 2;
      const targetY = (space.map_y / 100) * frame.scrollHeight - frame.clientHeight / 2;
      frame.scrollTo({
        left: Math.max(0, targetX),
        top: Math.max(0, targetY),
        behavior: 'smooth',
      });
    }, 80);
  }

  getRomanNumeral(idx: number): string {
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return numerals[idx] ?? String(idx + 1);
  }

  // ── Resource helpers ─────────────────────────────────────────────
  readonly modalImages   = signal<any[]>([]);
  readonly modalImageIdx = signal(0);

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

  ngOnInit(): void {
    this.api.get<any>(`/purchases/${this.purchaseId}`).subscribe({
      next: (purchase) => {
        this.variant.set(purchase);
        const { tour_id, tour_variant_id } = purchase;
        this.api.get<any[]>(`/tours/${tour_id}/variants/${tour_variant_id}/stops`).subscribe({
          next: (stops) => { this.stops.set(stops); this.loading.set(false); },
          error: ()      => this.loading.set(false),
        });

        this.api.get<any>(`/tours/${tour_id}/variants/${tour_variant_id}`).subscribe(detail => {
          this.variant.update(v => ({ ...v, ...detail }));
          if (detail.spaces) this.mapSpaces.set(detail.spaces);
        });
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Compass to next stop ─────────────────────────────────────────
  readonly compassOpen             = signal(false);
  readonly userPosition            = signal<{ lat: number; lng: number } | null>(null);
  readonly userHeading             = signal<number | null>(null);
  readonly compassError            = signal<string | null>(null);
  readonly compassPermissionDenied = signal(false);

  private geoWatchId: number | null = null;
  private orientationListener: ((e: any) => void) | null = null;

  get isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  get isAndroid(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /android/i.test(navigator.userAgent);
  }

  readonly currentStop = computed(() => {
    const id = this.expandedStopId();
    if (!id) return null;
    return this.stops().find(s => s.id === id) ?? null;
  });

  readonly nextStop = computed(() => {
    const id = this.expandedStopId();
    if (!id) return null;
    const stops = this.stops();
    const idx = stops.findIndex(s => s.id === id);
    return idx >= 0 ? stops[idx + 1] ?? null : null;
  });

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

  /** Cumulative arrow rotation. Continuous (no modulo) so CSS rotates the short way at the 0/360 wrap. */
  readonly arrowDisplayAngle = signal(0);

  /** Last absolute arrow rotation we wrote, used to compute shortest-path delta. */
  private lastArrowAngle = 0;

  // ── Compass heading smoothing ─────────────────────────────────────
  /** Latest raw heading from the sensor (0–360). Updated only when delta exceeds the deadband. */
  private rawTargetHeading: number | null = null;
  /** Currently-displayed heading; chases rawTargetHeading via a rAF loop. */
  private currentDisplayHeading: number | null = null;
  private headingRafId: number | null = null;

  /** Sensor noise floor — raw deltas below this are dropped as jitter. */
  private readonly HEADING_DEADBAND_DEG = 0.6;
  /** Per-frame interpolation factor toward the target (lower = smoother, slower). */
  private readonly HEADING_INTERP_RATE  = 0.08;
  /** Snap-to-target threshold — stops the animation when within this many degrees. */
  private readonly HEADING_SETTLE_DEG   = 0.1;

  private readonly _arrowEffect = effect(() => {
    const b = this.bearingDegrees();
    const h = this.userHeading();
    if (b == null) return;
    const target = h == null ? b : ((b - h) + 360) % 360;
    const currentMod = ((this.lastArrowAngle % 360) + 360) % 360;
    let diff = target - currentMod;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    this.lastArrowAngle += diff;
    this.arrowDisplayAngle.set(this.lastArrowAngle);
  }, { allowSignalWrites: true });

  openCompass(): void {
    this.compassOpen.set(true);
    this.userPosition.set(null);
    this.userHeading.set(null);
    this.compassError.set(null);
    this.compassPermissionDenied.set(false);
    this.rawTargetHeading = null;
    this.currentDisplayHeading = null;
    this.lastArrowAngle = 0;
    this.arrowDisplayAngle.set(0);

    this.startGeoWatch();

    const reqPermFn = (DeviceOrientationEvent as any)?.requestPermission;
    if (typeof reqPermFn === 'function') {
      reqPermFn().then((res: string) => {
        if (res === 'granted') this.attachOrientationListener();
      }).catch(() => {});
    } else {
      this.attachOrientationListener();
    }
  }

  private startGeoWatch(): void {
    if (this.geoWatchId != null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }
    if (!('geolocation' in navigator)) {
      this.compassError.set('Geolocation is not supported on this device.');
      return;
    }
    this.geoWatchId = navigator.geolocation.watchPosition(
      (pos) => this.userPosition.set({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.compassError.set('Location permission denied.');
          this.compassPermissionDenied.set(true);
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          this.compassError.set('Location unavailable.');
        } else if (err.code === err.TIMEOUT) {
          this.compassError.set('Location request timed out.');
        } else {
          this.compassError.set('Could not determine your location.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20_000 },
    );
  }

  private attachOrientationListener(): void {
    this.orientationListener = (e: any) => {
      let raw: number | null = null;
      if (typeof e.webkitCompassHeading === 'number') {
        raw = e.webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        raw = (360 - e.alpha) % 360;
      }
      if (raw == null) return;

      // Deadband: drop sub-degree jitter before it ever updates the target.
      if (this.rawTargetHeading != null) {
        let d = raw - this.rawTargetHeading;
        if (d > 180) d -= 360;
        else if (d < -180) d += 360;
        if (Math.abs(d) < this.HEADING_DEADBAND_DEG) return;
      }

      this.rawTargetHeading = raw;

      // First reading — snap so the arrow doesn't sweep from 0.
      if (this.currentDisplayHeading == null) {
        this.currentDisplayHeading = raw;
        this.userHeading.set(raw);
      }

      // Kick the rAF loop if it's idle. Bursts of events between frames coalesce naturally.
      if (this.headingRafId == null) {
        this.headingRafId = requestAnimationFrame(this.tickHeading);
      }
    };
    window.addEventListener('deviceorientationabsolute', this.orientationListener as any, true);
    window.addEventListener('deviceorientation', this.orientationListener as any, true);
  }

  private tickHeading = (): void => {
    this.headingRafId = null;
    const target = this.rawTargetHeading;
    const current = this.currentDisplayHeading;
    if (target == null || current == null) return;

    let delta = target - current;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;

    if (Math.abs(delta) < this.HEADING_SETTLE_DEG) {
      this.currentDisplayHeading = target;
      this.userHeading.set(target);
      return;
    }

    this.currentDisplayHeading = ((current + delta * this.HEADING_INTERP_RATE) + 360) % 360;
    this.userHeading.set(this.currentDisplayHeading);
    this.headingRafId = requestAnimationFrame(this.tickHeading);
  };

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
    if (this.headingRafId != null) {
      cancelAnimationFrame(this.headingRafId);
      this.headingRafId = null;
    }
    this.rawTargetHeading = null;
    this.currentDisplayHeading = null;
  }

  formatDistance(meters: number | null): string {
    if (meters == null) return '—';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  }

  ngOnDestroy(): void {
    this.closeCompass();
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
