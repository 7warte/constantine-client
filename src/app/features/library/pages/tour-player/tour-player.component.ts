import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, ElementRef, ViewChild, NgZone, PLATFORM_ID, inject, signal, computed, effect, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { gsap } from 'gsap';
import * as L from 'leaflet';
import { ApiService } from '../../../../core/services/api.service';
import { OfflineService } from '../../../../core/offline/offline.service';
import { VenueAreaMapComponent } from '../../../../shared/components/venue-area-map/venue-area-map.component';

@Component({
  selector: 'app-tour-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, VenueAreaMapComponent],
  templateUrl: './tour-player.component.html',
  styleUrl: './tour-player.component.scss',
})
export class TourPlayerComponent implements OnInit, OnDestroy {
  private readonly api     = inject(ApiService);
  private readonly offline = inject(OfflineService);
  private readonly http  = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly host  = inject(ElementRef<HTMLElement>);
  private readonly zone  = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  // ── GSAP reveals ─────────────────────────────────────────────────
  // Itinerary venues slide up in a stagger when the tour loads.
  private animateItineraryIn(): void {
    this.zone.runOutsideAngular(() => setTimeout(() => {
      const rows = this.host.nativeElement.querySelectorAll('.tourp__itinerary-venue');
      if (!rows.length) return;
      gsap.from(rows, { y: 28, opacity: 0, duration: 0.55, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' });
    }, 60));
  }

  readonly loading = signal(true);
  readonly variant = signal<any | null>(null);
  readonly stops   = signal<any[]>([]);
  readonly started = signal(false);

  readonly expandedVenueIdx = signal<number | null>(null);
  readonly expandedStopId   = signal<string | null>(null);

  // Overflow menu in the tour header (auto-play toggle + End tour).
  readonly menuOpen = signal(false);

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

  // ── Audio (one element + custom transport — same model as the phone app) ──
  // A single <audio> for the whole tour, not a player per stop: the transport
  // lives at the top of the screen and the source swaps as you move between
  // stops. Browser-only (skipped during SSR).
  @ViewChild('audioEl') private audioRef?: ElementRef<HTMLAudioElement>;

  readonly playing     = signal(false);
  readonly currentTime = signal(0);
  readonly duration    = signal(0);
  readonly audioError  = signal<string | null>(null);

  /** The stop loaded into the transport. */
  readonly playingStop = computed(() => {
    const id = this.expandedStopId();
    if (!id) return null;
    for (const g of this.groupedStops()) {
      const found = g.stops.find((s: any) => s.id === id);
      if (found) return found;
    }
    return null;
  });

  /** Its 1-based position across the whole tour — the "STOP 3" label. */
  readonly playingStopNumber = computed(() => {
    const id = this.expandedStopId();
    if (!id) return null;
    let n = 0;
    for (const g of this.groupedStops()) {
      for (const s of g.stops) {
        n++;
        if (s.id === id) return n;
      }
    }
    return null;
  });

  readonly hasAudio = computed(() => !!this.getAudio(this.playingStop()));

  readonly progressPct = computed(() => {
    const d = this.duration();
    return d > 0 ? Math.min(100, (this.currentTime() / d) * 100) : 0;
  });

  private get audio(): HTMLAudioElement | null {
    return this.audioRef?.nativeElement ?? null;
  }

  /** Select a stop and play it. */
  playStop(stop: any): void {
    if (!stop) return;
    this.expandedStopId.set(stop.id);
    this.audioError.set(null);
    this.currentTime.set(0);
    this.duration.set(0);

    if (!this.getAudio(stop)) { this.playing.set(false); return; }

    // The [src] binding lands on the next tick, so load/play after it.
    setTimeout(() => {
      const el = this.audio;
      if (!el) return;
      el.load();
      el.play().then(() => this.playing.set(true)).catch(() => this.playing.set(false));
    });
  }

  togglePlay(): void {
    const el = this.audio;
    if (!el || !this.hasAudio()) return;
    if (el.paused) el.play().then(() => this.playing.set(true)).catch(() => { /* blocked */ });
    else { el.pause(); this.playing.set(false); }
  }

  seekBy(delta: number): void {
    const el = this.audio;
    if (!el || !this.hasAudio()) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  }

  /** Click anywhere on the progress track to scrub. */
  onSeekBarClick(event: MouseEvent): void {
    const el = this.audio;
    if (!el || !this.hasAudio() || !el.duration) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    el.currentTime = fraction * el.duration;
  }

  onTimeUpdate(): void      { this.currentTime.set(this.audio?.currentTime ?? 0); }
  onLoadedMetadata(): void  { this.duration.set(this.audio?.duration || 0); }
  onEnded(): void           { this.playing.set(false); }

  /** A media URL that 404s or times out used to fail silently. Say so. */
  onAudioError(): void {
    this.playing.set(false);
    this.audioError.set('This clip could not be loaded. Check your connection and try again.');
  }

  formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private resetAudioState(): void {
    const el = this.audio;
    if (el) { try { el.pause(); } catch { /* noop */ } }
    this.playing.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    this.audioError.set(null);
  }

  // ── Tour session ─────────────────────────────────────────────────
  /** List of stops, or the map — the two views of a running tour. */
  readonly viewMode = signal<'list' | 'map'>('list');

  /** Smooth-scroll the first element matching `selector` into view after `delay`
   *  (waits out any render/animation). Runs outside Angular so it never
   *  schedules change detection. */
  private scrollIntoViewLater(selector: string, block: ScrollLogicalPosition, delay: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.zone.runOutsideAngular(() => setTimeout(() => {
      this.host.nativeElement.querySelector(selector)
        ?.scrollIntoView({ behavior: 'smooth', block });
    }, delay));
  }

  startTour(): void {
    this.started.set(true);
    this.viewMode.set('list');
    // Live distances to every stop, exactly as the app shows them.
    this.acquireGeo('tour');

    const groups = this.groupedStops();
    if (!groups.length) return;
    this.expandedVenueIdx.set(0);

    const firstStop = groups[0].stops[0];
    if (firstStop) {
      // Select it, but don't auto-start playback: browsers block audio that the
      // user didn't ask for, and a silent "playing" state is worse than none.
      this.expandedStopId.set(firstStop.id);
    }
    this.scrollIntoViewLater('.player__now', 'start', 100);
  }

  endTour(): void {
    this.resetAudioState();
    this.started.set(false);
    this.expandedStopId.set(null);
    this.expandedVenueIdx.set(null);
    this.autoPlayNear.set(false);
    this.autoPlayed.clear();
    this.viewMode.set('list');
    this.releaseGeo('tour');
    this.releaseGeo('autoplay');
    this.releaseGeo('inline-map');
  }

  /** Tap a stop in the list: load it into the transport and play. */
  selectStop(stop: any): void {
    this.playStop(stop);
    const venueIdx = this.groupedStops().findIndex(g => g.stops.some((s: any) => s.id === stop.id));
    if (venueIdx >= 0) this.expandedVenueIdx.set(venueIdx);
  }

  setViewMode(mode: 'list' | 'map'): void {
    this.viewMode.set(mode);
    if (mode !== 'map') {
      this.releaseGeo('inline-map');
      this.inlineMap?.remove();
      this.inlineMap = null;
      return;
    }
    // The compass row needs a position + heading.
    this.acquireGeo('inline-map');
    this.attachOrientationListener();
    // Render once the container exists.
    setTimeout(() => this.renderInlineMap(), 60);
  }

  /** Live distance to a stop, formatted — the "· 120 m" on each list row. */
  stopDistanceLabel(stop: any): string | null {
    const d = this.stopDistanceMeters(stop);
    return d == null ? null : this.formatDistance(d);
  }

  /** 1-based position of a stop across the whole tour (the numbered disc). */
  stopNumber(stop: any): number {
    let n = 0;
    for (const group of this.groupedStops()) {
      for (const s of group.stops) {
        n++;
        if (s.id === stop.id) return n;
      }
    }
    return 0;
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

  // Stable start/finish coords for the venue-area map (computed → OnPush-safe).
  readonly startCoord = computed(() => {
    const v = this.variant();
    return v?.latitude != null && v?.longitude != null ? { lat: +v.latitude, lng: +v.longitude } : null;
  });
  readonly endCoord = computed(() => {
    const v = this.variant();
    return v?.end_latitude != null && v?.end_longitude != null ? { lat: +v.end_latitude, lng: +v.end_longitude } : null;
  });

  @ViewChild('mapFrame') mapFrameRef?: ElementRef<HTMLElement>;

  closeMap(): void {
    this.showMapModal.set(false);
    this.areaMap?.remove();
    this.areaMap = null;
    this.clearRoute();
    // Release the route's claim on the GPS watch; it keeps running if the compass
    // or an open venue still need it.
    this.releaseGeo('route');
  }

  openMap(): void {
    this.clearRoute();   // the map button shows the venue overview, not a route
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

  // ── Inline map (the running tour's Map view) ─────────────────────────────
  // Separate instance from the modal's `areaMap` — both can't own the same
  // container, and this one plots every *stop*, not just the venues, which is
  // what the app's map shows.
  private inlineMap: L.Map | null = null;
  private inlineUserMarker: L.CircleMarker | null = null;

  private renderInlineMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.getElementById('player-inline-map');
    if (!el) return;

    this.inlineMap?.remove();
    this.inlineUserMarker = null;

    const zoomable = this.offline.online();
    const map = L.map(el, {
      zoomControl: zoomable,
      scrollWheelZoom: zoomable,
      doubleClickZoom: zoomable,
      touchZoom: zoomable,
      boxZoom: zoomable,
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; OpenStreetMap',
      maxZoom: 20,
    } as any).addTo(map);

    const all: L.LatLngExpression[] = [];

    // Venue areas, tinted with the venue's own colour.
    this.mapSpaces().forEach((sp) => {
      const poly = this.parsePolygon(sp.polygon);
      const color = sp.color || '#c98a8c';
      if (poly.length >= 3) {
        L.polygon(poly as any, { color: '#1a1a1a', weight: 1, fillColor: color, fillOpacity: 0.18 })
          .addTo(map).bindTooltip(sp.name);
        poly.forEach(p => all.push(p));
      }
    });

    // A numbered pin per stop, tapping one plays it.
    let n = 0;
    for (const group of this.groupedStops()) {
      for (const stop of group.stops) {
        n++;
        if (stop.latitude == null || stop.longitude == null) continue;
        const ll: L.LatLngExpression = [+stop.latitude, +stop.longitude];
        L.marker(ll, { icon: this.numberIcon(String(n), group.spaceColor || '#c98a8c') })
          .addTo(map)
          .bindTooltip(`${n}. ${stop.title}`)
          .on('click', () => this.zone.run(() => this.selectStop(stop)));
        all.push(ll);
      }
    }

    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 17 });
    else map.setView([41.9028, 12.4964], 5);
    setTimeout(() => map.invalidateSize(), 60);
    this.inlineMap = map;
    this.updateInlineUserDot();
  }

  /** "You are here" dot on the inline map, following the GPS watch. */
  private readonly _inlineUserDotEffect = effect(() => {
    this.userPosition();               // tracked
    untracked(() => this.updateInlineUserDot());
  });

  private updateInlineUserDot(): void {
    const map = this.inlineMap;
    const pos = this.userPosition();
    if (!map || !pos) return;
    const ll: L.LatLngExpression = [pos.lat, pos.lng];
    if (!this.inlineUserMarker) {
      this.inlineUserMarker = L.circleMarker(ll, {
        radius: 8, color: '#ffffff', weight: 3, fillColor: '#2b7fff', fillOpacity: 1,
      }).addTo(map).bindTooltip('You are here');
    } else {
      this.inlineUserMarker.setLatLng(ll);
    }
  }

  // ── Interactive area map (venue polygons + start/finish) ─────────────────
  private renderAreaMap(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.getElementById('player-area-map');
    if (!el) return;
    this.areaMap?.remove();
    this.routeLayer = null;   // belonged to the old map instance
    this.userMarker = null;

    // Markers live under assets/offline (precached by the service worker) so the
    // area map still renders its pins when the tour is played offline.
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/offline/marker-icon-2x.png',
      iconUrl: 'assets/offline/marker-icon.png',
      shadowUrl: 'assets/offline/marker-shadow.png',
    });

    // Offline the map tiles can't load, so zooming just reveals blank tiles —
    // lock zoom (keep panning) and hide the zoom control when there's no network.
    const zoomable = this.offline.online();
    const map = L.map(el, {
      zoomControl: zoomable,
      scrollWheelZoom: zoomable,
      doubleClickZoom: zoomable,
      touchZoom: zoomable,
      boxZoom: zoomable,
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
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

  // ── Walking route to the next stop (Stadia routing, keyless/domain auth) ──
  readonly routeFromTo  = signal<{ from: any; to: any } | null>(null);
  readonly routeInfo    = signal<{ distanceM: number; durationS: number } | null>(null);
  readonly routeLoading = signal(false);
  readonly routeError   = signal<string | null>(null);
  private  routeGeometry: [number, number][] | null = null;
  private  routeLayer: L.LayerGroup | null = null;
  private  userMarker: L.CircleMarker | null = null;

  // Keep the "you are here" dot in sync with the live GPS position while a route
  // is shown. areaMap isn't a signal, so applyRouteToMap() also calls the updater
  // once the map exists; this effect handles subsequent position updates.
  private readonly _userDotEffect = effect(() => {
    this.userPosition();
    this.routeFromTo();
    this.updateUserDot();
  });

  private updateUserDot(): void {
    const pos = this.userPosition();
    const map = this.areaMap;
    if (!pos || !map || !this.routeFromTo()) return;
    const ll: L.LatLngExpression = [pos.lat, pos.lng];
    if (!this.userMarker) {
      this.userMarker = L.circleMarker(ll, {
        radius: 8, color: '#ffffff', weight: 3, fillColor: '#2b7fff', fillOpacity: 1,
      }).addTo(map).bindTooltip('You are here');
    } else {
      this.userMarker.setLatLng(ll);
    }
  }

  /** Open the map and draw the pedestrian route from the current stop to the next. */
  navigateToNextStop(): void {
    const from = this.currentStop();
    const to   = this.nextStop();
    if (!from || from.latitude == null || !to || to.latitude == null) return;

    this.routeFromTo.set({ from, to });
    this.routeInfo.set(null);
    this.routeError.set(null);
    this.routeGeometry = null;

    this.acquireGeo('route');   // live "you are here" dot on the route
    this.showMapModal.set(true);
    setTimeout(() => this.renderAreaMap(), 80);
    this.fetchWalkingRoute(from, to);
  }

  private fetchWalkingRoute(from: any, to: any): void {
    this.routeLoading.set(true);
    const body = {
      locations: [
        { lat: +from.latitude, lon: +from.longitude },
        { lat: +to.latitude,   lon: +to.longitude },
      ],
      costing: 'pedestrian',
      units: 'kilometers',
    };
    // Keyless: the browser's Referer (constantine.tours) authenticates via Stadia's
    // domain allowlist — same mechanism as the map tiles, no API key needed.
    this.http.post<any>('https://api.stadiamaps.com/route/v1', body).subscribe({
      next: (res) => {
        const leg = res?.trip?.legs?.[0];
        const summary = res?.trip?.summary;
        if (!leg?.shape) {
          this.routeError.set('No walking route found between these stops.');
          this.routeLoading.set(false);
          return;
        }
        this.routeGeometry = this.decodePolyline(leg.shape, 6);
        this.routeInfo.set({ distanceM: (summary?.length ?? 0) * 1000, durationS: summary?.time ?? 0 });
        this.routeLoading.set(false);
        this.applyRouteToMap();
      },
      error: () => {
        this.routeError.set('Could not load the route. Check your connection and try again.');
        this.routeLoading.set(false);
      },
    });
  }

  /** Draw the fetched route + endpoints on the area map (retries until it exists). */
  private applyRouteToMap(attempt = 0): void {
    const geom = this.routeGeometry;
    if (!geom || geom.length === 0) return;
    const map = this.areaMap;
    if (!map) {
      if (attempt < 10) setTimeout(() => this.applyRouteToMap(attempt + 1), 80);
      return;
    }

    this.routeLayer?.remove();
    const layer = L.layerGroup();
    L.polyline(geom as any, { color: '#f57c00', weight: 5, opacity: 0.85 }).addTo(layer);

    const ft = this.routeFromTo();
    if (ft?.from?.latitude != null) {
      L.marker([+ft.from.latitude, +ft.from.longitude]).addTo(layer).bindTooltip(`From: ${ft.from.title}`);
    }
    if (ft?.to?.latitude != null) {
      L.marker([+ft.to.latitude, +ft.to.longitude]).addTo(layer).bindTooltip(`To: ${ft.to.title}`);
    }
    layer.addTo(map);
    this.routeLayer = layer;

    map.fitBounds(L.latLngBounds(geom as any), { padding: [40, 40], maxZoom: 18 });
    setTimeout(() => map.invalidateSize(), 60);
    this.updateUserDot();   // draw the GPS dot immediately if we already have a fix
  }

  private clearRoute(): void {
    this.routeLayer?.remove();
    this.routeLayer = null;
    this.userMarker?.remove();
    this.userMarker = null;
    this.routeGeometry = null;
    this.routeFromTo.set(null);
    this.routeInfo.set(null);
    this.routeError.set(null);
    this.routeLoading.set(false);
  }

  /** Decode a Valhalla/Google encoded polyline (Stadia uses precision 6). */
  private decodePolyline(str: string, precision = 6): [number, number][] {
    let index = 0, lat = 0, lng = 0, b: number;
    const coords: [number, number][] = [];
    const factor = Math.pow(10, precision);
    while (index < str.length) {
      let result = 0, shift = 0;
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      result = 0; shift = 0;
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      coords.push([lat / factor, lng / factor]);
    }
    return coords;
  }

  formatDuration(seconds: number): string {
    const min = Math.max(1, Math.round(seconds / 60));
    if (min < 60) return `${min} min walk`;
    return `${Math.floor(min / 60)} h ${min % 60} min walk`;
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
          next: (stops) => {
            this.stops.set(stops);
            this.loading.set(false);
            this.animateItineraryIn();
            this.resolveOfflineMedia();
          },
          error: ()      => this.loading.set(false),
        });

        this.api.get<any>(`/tours/${tour_id}/variants/${tour_variant_id}`).subscribe(detail => {
          this.variant.update(v => ({ ...v, ...detail }));
          if (detail.spaces) this.mapSpaces.set(detail.spaces);
          this.resolveOfflineMedia();
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private blobUrls: string[] = [];

  /** For a saved-offline tour, swap remote media URLs for cached blob: URLs so
   *  audio, images and the map render without a network connection. */
  private async resolveOfflineMedia(): Promise<void> {
    if (!this.offline.isSaved(this.purchaseId)) return;

    const swap = async (u: string | null | undefined): Promise<string | null> => {
      if (!u || u.startsWith('blob:')) return null;
      const b = await this.offline.getMediaUrl(u);
      if (b) this.blobUrls.push(b);
      return b;
    };

    // Stop media (audio / images / pdf)
    const stops = this.stops();
    let changed = false;
    for (const s of stops) for (const m of (s.media ?? [])) {
      const b = await swap(m.url);
      if (b) { m.url = b; changed = true; }
    }
    if (changed) this.stops.set([...stops]);

    // Variant-level media (map image, presentation audio, cover)
    const v = this.variant();
    if (v) {
      const patch: any = {};
      for (const k of ['map_image_url', 'map_image_square_url', 'presentation_audio_url', 'tour_cover_image_url', 'cover_url']) {
        const b = await swap(v[k]);
        if (b) patch[k] = b;
      }
      if (Object.keys(patch).length) this.variant.update(x => ({ ...x, ...patch }));
    }
  }

  // ── Compass to next stop ─────────────────────────────────────────
  readonly compassOpen             = signal(false);
  readonly userPosition            = signal<{ lat: number; lng: number } | null>(null);
  readonly userHeading             = signal<number | null>(null);
  readonly compassError            = signal<string | null>(null);
  readonly compassPermissionDenied = signal(false);

  private geoWatchId: number | null = null;
  // A single GPS watch is shared between the live stop distances, the compass and
  // the on-route "you are here" dot. Each acquires/releases by name; the watch
  // runs while at least one consumer needs it.
  private readonly geoConsumers = new Set<string>();
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

  // Both the current and next stop need coordinates to draw a route between them.
  readonly canRouteToNextStop = computed(() => {
    const cur  = this.currentStop();
    const next = this.nextStop();
    return !!(cur && cur.latitude != null && cur.longitude != null &&
              next && next.latitude != null && next.longitude != null);
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

    this.acquireGeo('compass');

    const reqPermFn = (DeviceOrientationEvent as any)?.requestPermission;
    if (typeof reqPermFn === 'function') {
      reqPermFn().then((res: string) => {
        if (res === 'granted') this.attachOrientationListener();
      }).catch(() => {});
    } else {
      this.attachOrientationListener();
    }
  }

  /** How close (metres) the user must be to a stop to count as "here". Sized for
   *  typical phone-GPS error (±5–20 m) so the badge lands on the right stop. */
  private readonly HERE_RADIUS_M = 25;

  /** Live distance from the user to a stop, in metres (null until located or if
   *  the stop has no coordinates). Works fully offline — GPS needs no network and
   *  the stop coordinates are part of the cached tour data. */
  private stopDistanceMeters(stop: any): number | null {
    const pos = this.userPosition();
    if (!pos || stop?.latitude == null || stop?.longitude == null) return null;
    return haversineKm(pos.lat, pos.lng, +stop.latitude, +stop.longitude) * 1000;
  }

  /** True when the user is standing at this stop — drives the "You are here" badge. */
  isUserAtStop(stop: any): boolean {
    const d = this.stopDistanceMeters(stop);
    return d != null && d <= this.HERE_RADIUS_M;
  }

  /** True when close enough that the stop flashes the "you're near" icon in place
   *  of its number (matches the phone app). */
  isNearStop(stop: any): boolean {
    const d = this.stopDistanceMeters(stop);
    return d != null && d <= 20;
  }

  // ── Auto-play on arrival ─────────────────────────────────────────
  /** Walk into a stop and its clip opens and plays itself — the same behaviour
   *  as the phone app. Wider than HERE_RADIUS_M so playback starts as you walk
   *  up to a stop rather than once you're on top of it. */
  private readonly AUTOPLAY_RADIUS_M = 40;

  readonly autoPlayNear = signal(false);
  readonly autoPlayError = signal<string | null>(null);
  /** Stops already auto-played, so walking back past one doesn't restart it. */
  private readonly autoPlayed = new Set<string>();

  toggleAutoPlayNear(on: boolean): void {
    this.autoPlayError.set(null);
    if (!on) {
      this.autoPlayNear.set(false);
      this.releaseGeo('autoplay');
      return;
    }
    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
      this.autoPlayError.set('This browser cannot share your location.');
      return;
    }
    this.acquireGeo('autoplay');
    this.autoPlayNear.set(true);
  }

  private readonly _autoPlayEffect = effect(() => {
    if (!this.autoPlayNear() || !this.started()) return;
    if (!this.userPosition()) return;   // tracked: re-runs on every fix

    let best: any = null;
    let bestDist = Infinity;
    for (const group of this.groupedStops()) {
      for (const stop of group.stops) {
        if (this.autoPlayed.has(stop.id) || !this.getAudio(stop)) continue;
        const d = this.stopDistanceMeters(stop);
        if (d != null && d <= this.AUTOPLAY_RADIUS_M && d < bestDist) {
          bestDist = d;
          best = stop;
        }
      }
    }
    if (!best || best.id === this.expandedStopId()) return;

    this.autoPlayed.add(best.id);
    untracked(() => this.selectStop(best));
  }, { allowSignalWrites: true });

  // ── "Open in the app" nudge ──────────────────────────────────────
  private readonly APP_NUDGE_KEY = 'constantine.appNudgeDismissed';

  readonly appNudgeDismissed = signal(
    isPlatformBrowser(this.platformId) && localStorage.getItem(this.APP_NUDGE_KEY) === '1',
  );

  /** Deep link into the phone app's Tour tab. Does nothing if it isn't installed
   *  — which is every public visitor until the app ships, hence "dismissible". */
  get appDeepLink(): string {
    return 'constantine://tour';
  }

  dismissAppNudge(): void {
    this.appNudgeDismissed.set(true);
    if (isPlatformBrowser(this.platformId)) {
      try { localStorage.setItem(this.APP_NUDGE_KEY, '1'); } catch { /* private mode */ }
    }
  }

  private acquireGeo(consumer: string): void {
    this.geoConsumers.add(consumer);
    if (this.geoWatchId == null) this.startGeoWatch();
  }

  private releaseGeo(consumer: string): void {
    this.geoConsumers.delete(consumer);
    if (this.geoConsumers.size === 0) this.stopGeoWatch();
  }

  private stopGeoWatch(): void {
    if (this.geoWatchId != null) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
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
    this.releaseGeo('compass');
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
    this.geoConsumers.clear();
    this.stopGeoWatch();
    this.resetAudioState();
    this.areaMap?.remove();
    this.areaMap = null;
    this.inlineMap?.remove();
    this.inlineMap = null;
    this.blobUrls.forEach(u => URL.revokeObjectURL(u));
    this.blobUrls = [];
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
