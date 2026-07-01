import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, ElementRef, ViewChild, NgZone, PLATFORM_ID, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { gsap } from 'gsap';
import * as L from 'leaflet';
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
  private readonly host  = inject(ElementRef<HTMLElement>);
  private readonly zone  = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  // ── GSAP reveals ─────────────────────────────────────────────────
  // Itinerary venues slide up in a stagger when the tour loads.
  private animateItineraryIn(): void {
    this.zone.runOutsideAngular(() => setTimeout(() => {
      const panels = this.host.nativeElement.querySelectorAll('.player__venue-panel');
      if (!panels.length) return;
      gsap.from(panels, { y: 28, opacity: 0, duration: 0.55, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' });
    }, 60));
  }

  // A stop's contents (audio, text, photos…) stagger in when it opens.
  private animateStopBody(): void {
    this.zone.runOutsideAngular(() => setTimeout(() => {
      const body = this.host.nativeElement.querySelector('.player__stop-panel.mat-expanded .player__stop-body');
      if (!body || !body.children.length) return;
      gsap.from(body.children, { y: 18, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out', clearProps: 'transform,opacity' });
    }, 120));
  }

  readonly loading = signal(true);
  readonly variant = signal<any | null>(null);
  readonly stops   = signal<any[]>([]);
  readonly started = signal(false);

  readonly expandedVenueIdx = signal<number | null>(null);
  readonly expandedStopId   = signal<string | null>(null);

  readonly purchaseId = this.route.snapshot.paramMap.get('purchaseId') ?? '';

  readonly groupedStops = computed(() => {
    const stops = this.stops();
    const groups: { spaceId: string | null; spaceName: string | null; spaceColor: string | null; stops: any[] }[] = [];
    const map = new Map<string | null, any[]>();
    const nameMap = new Map<string | null, string | null>();
    const colorMap = new Map<string | null, string | null>();

    for (const stop of stops) {
      const key = stop.space_id ?? null;
      if (!map.has(key)) {
        map.set(key, []);
        nameMap.set(key, stop.space_name ?? null);
        colorMap.set(key, stop.space_color ?? null);
      }
      map.get(key)!.push(stop);
    }

    for (const [spaceId, spaceStops] of map) {
      groups.push({
        spaceId,
        spaceName: nameMap.get(spaceId) ?? null,
        spaceColor: colorMap.get(spaceId) ?? null,
        stops: spaceStops,
      });
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

  // ── Audio (Plyr — one expanded stop at a time) ───────────────────
  // Plyr enhances the lazily-rendered <audio> of the open stop into a
  // professional player: seekable bar with buffered range, playback-speed
  // menu, and a loading state. Browser-only (skipped during SSR).
  private player: any = null;

  private initAudioPlayer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.zone.runOutsideAngular(() => setTimeout(() => {
      const el = this.host.nativeElement.querySelector(
        '.player__stop-panel.mat-expanded .player__audio-el',
      ) as HTMLAudioElement | null;
      this.destroyAudioPlayer();
      if (!el) return;
      import('plyr').then((mod) => {
        const Plyr = (mod as any).default ?? mod;
        this.player = new Plyr(el, {
          controls: ['play', 'rewind', 'progress', 'current-time', 'duration', 'fast-forward', 'settings'],
          settings: ['speed'],
          speed: { selected: 1, options: [0.75, 1, 1.25, 1.5, 1.75, 2] },
          seekTime: 10,
          keyboard: { focused: true, global: false },
          tooltips: { controls: false, seek: true },
          // Serve the icon sprite locally so the player works offline / on the LAN
          // (Plyr otherwise fetches it from cdn.plyr.io).
          iconUrl: 'assets/plyr/plyr.svg',
        });
      }).catch(() => {});
    }, 130));
  }

  private destroyAudioPlayer(): void {
    if (this.player) {
      try { this.player.destroy(); } catch { /* already gone */ }
      this.player = null;
    }
  }

  private resetAudioState(): void {
    this.destroyAudioPlayer();
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
    this.animateStopBody();
    this.initAudioPlayer();
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

    this.animateStopBody();
    this.initAudioPlayer();

    setTimeout(() => {
      const el = document.querySelector('.player__venue-panel');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // ── Map modal ────────────────────────────────────────────────────
  readonly showMapModal = signal(false);
  readonly mapSpaces    = signal<any[]>([]);
  private areaMap: L.Map | null = null;

  // Use a real interactive map whenever there's geo data (drawn venue areas,
  // venue coords, or a start point) — otherwise fall back to the screenshot.
  readonly hasAreaMap = computed(() => {
    if (this.variant()?.latitude != null) return true;
    return this.mapSpaces().some(s => s.polygon || (s.latitude != null && s.longitude != null));
  });

  @ViewChild('mapFrame') mapFrameRef?: ElementRef<HTMLElement>;

  closeMap(): void {
    this.showMapModal.set(false);
    this.areaMap?.remove();
    this.areaMap = null;
  }

  openMap(): void {
    this.showMapModal.set(true);
    if (this.hasAreaMap()) {
      setTimeout(() => this.renderAreaMap(), 80);
      return;
    }
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

  // ── Interactive area map (venue polygons + start/finish) ─────────────────
  private renderAreaMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.getElementById('player-area-map');
    if (!el) return;
    this.areaMap?.remove();

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });

    const map = L.map(el, { zoomControl: true });
    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; OpenStreetMap',
      maxZoom: 20,
    } as any).addTo(map);

    const all: L.LatLngExpression[] = [];

    this.mapSpaces().forEach((sp, i) => {
      const poly = this.parsePolygon(sp.polygon);
      const color = sp.color || '#c98a8c';
      if (poly.length >= 3) {
        L.polygon(poly as any, { color, weight: 2, fillColor: color, fillOpacity: 0.2 })
          .addTo(map).bindTooltip(sp.name);
        poly.forEach(p => all.push(p));
        L.marker(this.centroid(poly) as any, { icon: this.numberIcon(this.getRomanNumeral(i), color) })
          .addTo(map).bindTooltip(sp.name);
      } else if (sp.latitude != null && sp.longitude != null) {
        const ll: L.LatLngExpression = [+sp.latitude, +sp.longitude];
        L.marker(ll, { icon: this.numberIcon(this.getRomanNumeral(i), color) }).addTo(map).bindTooltip(sp.name);
        all.push(ll);
      }
    });

    const v = this.variant();
    if (v?.latitude != null && v?.longitude != null) {
      const s: L.LatLngExpression = [+v.latitude, +v.longitude];
      L.marker(s).addTo(map).bindTooltip('Start');
      all.push(s);
    }
    if (v?.end_latitude != null && v?.end_longitude != null) {
      const e: L.LatLngExpression = [+v.end_latitude, +v.end_longitude];
      L.marker(e).addTo(map).bindTooltip('Finish');
      all.push(e);
    }

    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 17 });
    else map.setView([41.9028, 12.4964], 5);
    setTimeout(() => map.invalidateSize(), 60);
    this.areaMap = map;
  }

  private parsePolygon(raw: any): [number, number][] {
    const arr = typeof raw === 'string' ? this.safeJson(raw) : raw;
    return Array.isArray(arr)
      ? arr.filter((p: any) => Array.isArray(p) && p.length === 2).map((p: any) => [+p[0], +p[1]])
      : [];
  }
  private safeJson(s: string): any { try { return JSON.parse(s); } catch { return null; } }
  private centroid(pts: [number, number][]): [number, number] {
    const n = pts.length || 1;
    const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return [sum[0] / n, sum[1] / n];
  }
  private numberIcon(label: string, color: string): L.DivIcon {
    return L.divIcon({
      className: 'player__area-marker',
      html: `<span style="background:${color}">${label}</span>`,
      iconSize: [26, 26], iconAnchor: [13, 13],
    });
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
          next: (stops) => { this.stops.set(stops); this.loading.set(false); this.animateItineraryIn(); },
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
    this.destroyAudioPlayer();
    this.areaMap?.remove();
    this.areaMap = null;
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
