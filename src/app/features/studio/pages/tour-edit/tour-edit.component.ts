import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, AfterViewChecked, AfterViewInit,
  ElementRef, viewChild, inject, signal, computed,
} from '@angular/core';
import * as L from 'leaflet';
import html2canvas from 'html2canvas';
import { trigger, transition, style, animate } from '@angular/animations';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, debounceTime, switchMap, of, Subscription } from 'rxjs';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TagInputComponent } from '../../../../shared/components/tag-input/tag-input.component';
import { AudioRecorderComponent } from '../../../../shared/components/audio-recorder/audio-recorder.component';
import { SelectOnFocusDirective } from '../../../../shared/directives/select-on-focus.directive';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../../environments/environment';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}


@Component({
  selector: 'app-tour-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-28px)', maxHeight: 0 }),
        animate('400ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateX(0)', maxHeight: '600px' })),
      ]),
    ]),
  ],
  imports: [ReactiveFormsModule, RouterLink, CommonModule, TagInputComponent, AudioRecorderComponent, SelectOnFocusDirective, MatIconModule],
  templateUrl: './tour-edit.component.html',
  styleUrl: './tour-edit.component.scss',
})
export class TourEditComponent implements OnInit, OnDestroy, AfterViewChecked, AfterViewInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(ApiService);
  private readonly auth   = inject(AuthService);
  private readonly http   = inject(HttpClient);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host   = inject(ElementRef<HTMLElement>);

  // ── State ──────────────────────────────────────────────────────────────
  readonly loading      = signal(false);
  readonly saving       = signal(false);
  readonly publishing   = signal(false);
  readonly uploading    = signal(false);
  readonly error        = signal<string | null>(null);
  readonly tour         = signal<any | null>(null);
  readonly tourTags     = signal<string[]>([]);
  readonly coverUrl              = signal<string | null>(null);
  readonly presentationAudioUrl  = signal<string | null>(null);
  readonly showPresentationRecorder = signal(false);
  readonly uploadingAudio        = signal(false);

  // ── Cover hero (background gradient/image + overlaid title) ───────────────
  readonly gradientIds = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10'] as const;
  readonly coverGradient   = signal<string>('g1');
  readonly bgPickerOpen    = signal(false);
  // For a brand-new tour the cover can't be uploaded yet (no tour id). We hold
  // the chosen file + a local preview and upload it once the tour is created.
  private  pendingCoverFile      = signal<File | null>(null);
  readonly pendingCoverPreview   = signal<string | null>(null);
  // Background image shown in the hero: saved cover, or the not-yet-saved preview.
  readonly heroImage = computed(() => this.coverUrl() ?? this.pendingCoverPreview());
  readonly step       = signal(1);
  readonly stops      = signal<any[]>([]);
  readonly spaces     = signal<any[]>([]);
  readonly variantId  = signal<string | null>(null);

  readonly routeTourId = this.route.snapshot.paramMap.get('tourId');
  readonly isNew       = computed(() => !this.routeTourId && !this.tour());
  readonly tourId      = computed(() => this.tour()?.id ?? this.routeTourId);
  readonly pageTitle   = computed(() => this.isNew() ? 'Create tour' : 'Edit tour');
  // Step 2 (Location) is "done" once the tour has start coordinates saved.
  readonly step2Done   = computed(() => this.tour()?.latitude != null && this.tour()?.longitude != null);
  // Step 3 (Stops) is "done" once the tour has at least one stop.
  readonly step3Done   = computed(() => this.stops().length > 0);
  // Price shown in the publish preview.
  readonly previewPrice = computed(() => {
    const c = this.tour()?.price_cents ?? 0;
    return c > 0 ? `€${(c / 100).toFixed(2)}` : 'Free';
  });
  readonly showPublishIntro = signal(false);

  // Preview image lightbox — lets the creator view stop images as a buyer would.
  readonly previewImages   = signal<any[]>([]);
  readonly previewImageIdx = signal(0);
  stopImages(stop: any): any[] { return (stop?.media ?? []).filter((m: any) => m.media_type === 'image'); }
  openPreviewImage(images: any[], clicked: any): void {
    this.previewImageIdx.set(Math.max(0, images.findIndex(im => im.id === clicked.id)));
    this.previewImages.set(images);
  }
  closePreviewImage(): void { this.previewImages.set([]); }
  nextPreviewImage(): void { this.previewImageIdx.update(i => (i + 1) % this.previewImages().length); }
  prevPreviewImage(): void { this.previewImageIdx.update(i => (i - 1 + this.previewImages().length) % this.previewImages().length); }

  // Title field — focused automatically when creating a new tour.
  readonly heroTitle = viewChild<ElementRef<HTMLInputElement>>('heroTitle');

  // ── New-tour title prompt ──────────────────────────────────────────────
  // When creating a tour we first ask for a title in a small modal; once it's
  // submitted the normal Basics flow continues (the title stays editable).
  readonly showTitlePrompt = signal(false);
  readonly titleDraft      = signal('');
  readonly titlePromptInput = viewChild<ElementRef<HTMLInputElement>>('titlePromptInput');

  /** Dismiss the new-tour prompt — same as Cancel: leave the unnamed tour. */
  cancelTitlePrompt(): void {
    this.router.navigate(['/studio/tours']);
  }

  confirmTitle(value: string): void {
    const title = value.trim() || 'My tour';
    this.form.controls.title.setValue(title);
    this.showTitlePrompt.set(false);
    // Drop the creator straight into the (still editable) inline title field.
    setTimeout(() => {
      const el = this.heroTitle()?.nativeElement;
      if (el) { el.focus(); el.select(); }
    });
  }

  // ── Step 1 form ────────────────────────────────────────────────────────
  readonly form = this.fb.nonNullable.group({
    title:            ['', [Validators.required, Validators.maxLength(200)]],
    description:      ['', Validators.maxLength(2000)],
    price_euros:      ['0', [Validators.required, Validators.min(0)]],
    setting:          [''],
    duration_minutes: [null as number | null],
  });

  // ── Price breakdown (Constantine takes a 9% platform fee per sale) ──────
  readonly PLATFORM_FEE_RATE = 0.09;
  priceNum(): number {
    const p = parseFloat(this.form.controls.price_euros.value || '0');
    return isNaN(p) || p < 0 ? 0 : p;
  }
  constantineFee(): number { return this.priceNum() * this.PLATFORM_FEE_RATE; }
  creatorRevenue(): number { return this.priceNum() * (1 - this.PLATFORM_FEE_RATE); }

  // ── Step 2 map state ───────────────────────────────────────────────────
  readonly sameAddress  = signal(false);

  toggleSameAddress(): void {
    const newVal = !this.sameAddress();
    this.sameAddress.set(newVal);
    if (!newVal) {
      this.endAddress.set('');
      this.endCoords.set(null);
      this.endSuggestions.set([]);
    }
    if (this.endMarker) {
      this.endMarker.remove();
      this.endMarker = null;
    }
  }


  // Shown over the map while the save-time screenshots are captured, so the
  // brief square resize never flashes on screen.
  readonly capturingMap = signal(false);

  // `…Address` holds the COMMITTED value (only ever set by clicking a list item);
  // `…AddressInput` holds the raw text being typed, used only to filter the list.
  readonly startAddress      = signal('');
  readonly endAddress        = signal('');
  readonly startAddressInput = signal('');
  readonly endAddressInput   = signal('');
  readonly startCoords  = signal<[number, number] | null>(null);
  readonly endCoords    = signal<[number, number] | null>(null);
  readonly startSuggestions = signal<any[]>([]);
  readonly endSuggestions   = signal<any[]>([]);
  // True when a ≥3-char search returned nothing — prompt the user to fix typos.
  readonly startNoResults = signal(false);
  readonly endNoResults   = signal(false);

  private geocode$ = new Subject<{ query: string; target: 'start' | 'end' }>();
  private geoSub!: Subscription;
  private map: L.Map | null = null;
  private mapRendered = false;
  private startMarker: L.Marker | null = null;
  private endMarker: L.Marker | null = null;

  // Read-only overview map on the Review & publish step (venue areas + stop pins).
  private reviewMap: L.Map | null = null;
  private reviewMapRendered = false;

  readonly mapHint = computed(() => {
    const sc = this.startCoords();
    const ec = this.endCoords();
    const same = this.sameAddress();
    if (!sc) return 'Type the start address above and choose it to drop the start pin.';
    if (same) return '';
    if (!ec) return 'Now type the end address above and choose it to drop the finish pin.';
    return '';
  });

  readonly mapThemes: { id: string; label: string; url: string; ext: string }[] = [
    { id: 'voyager',     label: 'Voyager',     url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'smooth',      label: 'Smooth',      url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'bright',      label: 'Bright',      url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'watercolor',  label: 'Watercolor',  url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', ext: 'jpg' },
    { id: 'toner',       label: 'Toner Lite',  url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'dark',        label: 'Dark',        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'osm',         label: 'Classic',     url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', ext: 'png' },
  ];
  readonly activeTheme = signal('toner');

  readonly showMapResetWarning = signal(false);

  // ── Map pin placement (legacy image-based — kept for back-compat) ──────
  readonly pinningSpace = signal<any | null>(null);
  readonly pinX = signal(50);
  readonly pinY = signal(50);
  private isDragging = false;

  // ── Venue GPS picker (Leaflet, 3-mode) ─────────────────────────────────
  readonly venuePickerOpen        = signal(false);
  readonly venuePickerSpace       = signal<any | null>(null);
  readonly venuePickerLat         = signal<number | null>(null);
  readonly venuePickerLng         = signal<number | null>(null);
  readonly venuePickerLocating    = signal(false);
  readonly venuePickerError       = signal<string | null>(null);
  // The venue is delineated by a self-closing polygon (a list of [lat,lng] vertices).
  readonly venuePolygon           = signal<[number, number][]>([]);
  // Soft warning when a stop is placed outside its venue's area.
  readonly stopAreaWarning        = signal<string | null>(null);
  private venuePickerMap: L.Map | null = null;
  private venuePolyLayer: L.Polygon | L.Polyline | null = null;
  private venueVertexLayers: L.CircleMarker[] = [];
  private venuePickerMapRendered = false;

  openVenuePicker(space: any): void {
    this.venuePickerSpace.set(space);
    this.venuePickerError.set(null);
    this.venuePickerLocating.set(false);

    // Load any existing polygon (JSONB comes back as a parsed array).
    const raw = typeof space.polygon === 'string' ? this.safeParse(space.polygon) : space.polygon;
    const poly: [number, number][] = Array.isArray(raw)
      ? raw.filter((p: any) => Array.isArray(p) && p.length === 2).map((p: any) => [+p[0], +p[1]])
      : [];
    this.venuePolygon.set(poly);

    // View target: polygon centroid, else saved point, else tour start.
    if (poly.length) {
      const c = this.polygonCentroid(poly);
      this.venuePickerLat.set(c[0]); this.venuePickerLng.set(c[1]);
    } else if (space.latitude != null && space.longitude != null) {
      this.venuePickerLat.set(+space.latitude); this.venuePickerLng.set(+space.longitude);
    } else {
      const tourStart = this.startCoords();
      this.venuePickerLat.set(tourStart ? tourStart[0] : null);
      this.venuePickerLng.set(tourStart ? tourStart[1] : null);
    }

    this.venuePickerOpen.set(true);
    this.venuePickerMapRendered = false;
  }

  closeVenuePicker(): void {
    this.venuePickerOpen.set(false);
    this.clearVenuePolyLayers();
    this.venuePickerMap?.remove();
    this.venuePickerMap = null;
    this.venuePickerMapRendered = false;
    this.venuePickerSpace.set(null);
    this.venuePolygon.set([]);
  }

  private safeParse(s: string): any {
    try { return JSON.parse(s); } catch { return null; }
  }

  useVenueCurrentLocation(): void {
    if (!('geolocation' in navigator)) {
      this.venuePickerError.set('Geolocation is not supported by this browser.');
      return;
    }
    this.venuePickerError.set(null);
    this.venuePickerLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.venuePickerLat.set(latitude);
        this.venuePickerLng.set(longitude);
        this.venuePickerLocating.set(false);
        // Just move the map there so the user can trace the area; don't drop a vertex.
        this.venuePickerMap?.setView([latitude, longitude], 17);
      },
      (err) => {
        this.venuePickerLocating.set(false);
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Allow location access or place the pin manually.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Location unavailable. Try again or place the pin manually.'
            : err.code === err.TIMEOUT
              ? 'Location request timed out. Try again.'
              : 'Could not determine your location.';
        this.venuePickerError.set(msg);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  // ── Venue polygon drawing ──────────────────────────────────────────────────
  undoVenueVertex(): void {
    this.venuePolygon.update(v => v.slice(0, -1));
    this.redrawVenuePolygon();
  }
  clearVenuePolygon(): void {
    this.venuePolygon.set([]);
    this.redrawVenuePolygon();
  }

  private redrawVenuePolygon(): void {
    if (!this.venuePickerMap) return;
    this.clearVenuePolyLayers();
    const color = this.spaceColor(this.venuePickerSpace());   // the venue being drawn
    const pts = this.venuePolygon();
    if (pts.length >= 3) {
      this.venuePolyLayer = L.polygon(pts as any, { color, fillColor: color, weight: 2, fillOpacity: 0.25 })
        .addTo(this.venuePickerMap);
    } else if (pts.length === 2) {
      this.venuePolyLayer = L.polyline(pts as any, { color, weight: 2, dashArray: '4 4' })
        .addTo(this.venuePickerMap);
    }
    pts.forEach((p, i) => {
      const m = L.circleMarker(p as any, { radius: 6, color, fillColor: '#fff', fillOpacity: 1, weight: 2 })
        .addTo(this.venuePickerMap!).bindTooltip(`${i + 1}`);
      this.venueVertexLayers.push(m);
    });
  }

  private clearVenuePolyLayers(): void {
    if (this.venuePolyLayer) { this.venuePolyLayer.remove(); this.venuePolyLayer = null; }
    this.venueVertexLayers.forEach(m => m.remove());
    this.venueVertexLayers = [];
  }

  private polygonCentroid(pts: [number, number][]): [number, number] {
    const n = pts.length || 1;
    const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return [sum[0] / n, sum[1] / n];
  }

  /** Parse a space's stored polygon (JSONB array or JSON string) into [lat,lng] pairs. */
  private getSpacePolygon(space: any): [number, number][] {
    const raw = typeof space?.polygon === 'string' ? this.safeParse(space.polygon) : space?.polygon;
    return Array.isArray(raw)
      ? raw.filter((p: any) => Array.isArray(p) && p.length === 2).map((p: any) => [+p[0], +p[1]] as [number, number])
      : [];
  }

  /** Ray-casting point-in-polygon ([lat,lng] points). */
  private pointInPolygon(lat: number, lng: number, poly: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [latI, lngI] = poly[i];
      const [latJ, lngJ] = poly[j];
      const intersect = ((lngI > lng) !== (lngJ > lng)) &&
        (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  saveVenueLocation(): void {
    const space = this.venuePickerSpace();
    const poly = this.venuePolygon();
    if (!space || poly.length < 3) {
      this.venuePickerError.set('Draw at least 3 points to outline the venue area.');
      return;
    }
    const vid = this.variantId();
    if (!vid) return;

    const c = this.polygonCentroid(poly);
    this.api.patch<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces/${space.id}`, {
      polygon:   poly.map(p => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))]),
      latitude:  Number(c[0].toFixed(6)),
      longitude: Number(c[1].toFixed(6)),
    }).subscribe(updated => {
      this.spaces.update(s => s.map(sp => sp.id === space.id ? updated : sp));
      this.closeVenuePicker();
    });
  }

  private renderVenuePickerMap(): void {
    const el = document.getElementById('venue-picker-map');
    if (!el || this.venuePickerMapRendered) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });

    this.venuePickerMap = L.map(el, { zoomControl: true, scrollWheelZoom: true });
    this.venuePickerMap.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');

    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
    } as any).addTo(this.venuePickerMap);

    // Show the OTHER venues' already-drawn areas (and any point-only venues as
    // dots) so the creator can see them and avoid overlapping a new area.
    const activeId = this.venuePickerSpace()?.id;
    const otherAreaPts: L.LatLngExpression[] = [];
    for (const sp of this.spaces()) {
      if (sp.id === activeId) continue;
      const poly = this.getSpacePolygon(sp);
      const otherColor = this.spaceColor(sp);
      if (poly.length >= 3) {
        L.polygon(poly as any, {
          color: otherColor, weight: 1.5, fillColor: otherColor, fillOpacity: 0.15,
          dashArray: '5 4', interactive: false,
        }).addTo(this.venuePickerMap).bindTooltip(sp.name);
        poly.forEach(p => otherAreaPts.push(p));
      } else if (sp.latitude != null && sp.longitude != null) {
        L.circleMarker([+sp.latitude, +sp.longitude], {
          radius: 6, color: otherColor, fillColor: otherColor, fillOpacity: 0.7, weight: 2,
        }).addTo(this.venuePickerMap).bindTooltip(sp.name);
        otherAreaPts.push([+sp.latitude, +sp.longitude]);
      }
    }

    this.venuePickerMapRendered = true;
    this.redrawVenuePolygon();

    // Initial view: fit the venue being edited if it has an area; otherwise frame
    // the existing venues + tour start so the creator sees what to avoid.
    const activePoly = this.venuePolygon();
    if (activePoly.length >= 2) {
      this.venuePickerMap.fitBounds(L.latLngBounds(activePoly as any), { padding: [40, 40], maxZoom: 18 });
    } else {
      const lat = this.venuePickerLat();
      const lng = this.venuePickerLng();
      const start = this.startCoords();
      const points: L.LatLngExpression[] = [...otherAreaPts];
      if (start) points.push(start);
      if (lat != null && lng != null) points.push([lat, lng]);

      if (points.length === 0) {
        this.venuePickerMap.setView([41.9028, 12.4964], 5);
      } else if (points.length === 1) {
        this.venuePickerMap.setView(points[0] as any, 16);
      } else {
        this.venuePickerMap.fitBounds(L.latLngBounds(points as any), { padding: [40, 40], maxZoom: 17 });
      }
    }

    // Each click drops a vertex; the polygon self-closes once it has 3+ points.
    this.venuePickerMap.on('click', (e: L.LeafletMouseEvent) => {
      this.venuePolygon.update(v => [...v, [e.latlng.lat, e.latlng.lng]]);
      this.redrawVenuePolygon();
    });

    setTimeout(() => this.venuePickerMap?.invalidateSize(), 100);
  }

  openPinModal(space: any): void {
    this.pinningSpace.set(space);
    this.pinX.set(space.map_x ?? 50);
    this.pinY.set(space.map_y ?? 50);
  }

  onPinDragStart(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onPinDragMove(event: MouseEvent | TouchEvent): void {
    if (!this.isDragging) return;
    const container = (event.currentTarget as HTMLElement);
    const rect = container.getBoundingClientRect();
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    this.pinX.set(x);
    this.pinY.set(y);
  }

  onPinDragEnd(): void {
    this.isDragging = false;
  }

  savePin(): void {
    const space = this.pinningSpace();
    if (!space) return;
    const vid = this.variantId();
    if (!vid) return;

    this.api.patch<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces/${space.id}`, {
      map_x: this.pinX(),
      map_y: this.pinY(),
    }).subscribe(updated => {
      this.spaces.update(s => s.map(sp => sp.id === space.id ? updated : sp));
      this.pinningSpace.set(null);
    });
  }

  getSpaceRomanNumeral(space: any): string {
    const idx = this.spaces().indexOf(space);
    const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return numerals[idx] ?? String(idx + 1);
  }

  getSpaceMapX(space: any): number | null {
    if (space.id === this.pinningSpace()?.id) return this.pinX();
    return space.map_x ?? null;
  }

  getSpaceMapY(space: any): number | null {
    if (space.id === this.pinningSpace()?.id) return this.pinY();
    return space.map_y ?? null;
  }

  // ── Step 3 space & stop forms ───────────────────────────────────────────
  readonly spaceForm = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    description: [''],
  });
  readonly addingSpace  = signal(false);
  readonly showExample  = signal(false);

  readonly stopForm = this.fb.nonNullable.group({
    title:       ['', Validators.required],
    description: [''],
    latitude:    [null as number | null],
    longitude:   [null as number | null],
  });
  readonly activeSpaceId     = signal<string | null>(null); // which space to add stop into
  readonly editingStopId     = signal<string | null>(null);
  // After naming a new POI we offer to drop a single location pin for it. While
  // that pin is being placed, these hold the target stop + its venue (so the
  // picker can draw the venue outline and the save writes straight to the stop).
  readonly pinPromptStop     = signal<{ id: string; title: string; space_id: string | null } | null>(null);
  readonly pinningStopId     = signal<string | null>(null);
  readonly pinningSpaceId    = signal<string | null>(null);
  readonly addingDirectionFor      = signal<string | null>(null); // stop id
  readonly addingSpaceDirectionFor = signal<string | null>(null); // space id
  // Reveal-on-demand inputs: the "new venue" field and per-venue "add point of
  // interest" field stay hidden behind a button until the creator opens them.
  readonly addingVenue  = signal(false);
  readonly addingPoiFor = signal<string | null>(null); // space id whose POI input is open

  openVenueInput(): void {
    this.addingVenue.set(true);
    this.focusAndSelect('new-venue-input');
  }
  openPoiInput(spaceId: string): void {
    this.addingPoiFor.set(spaceId);
    this.focusAndSelect('new-poi-input');
  }

  // ── Stop GPS location picker ───────────────────────────────────────────
  readonly locationPickerOpen = signal(false);
  readonly pickerLat          = signal<number | null>(null);
  readonly pickerLng          = signal<number | null>(null);
  readonly pickerLocating     = signal(false);
  readonly pickerError        = signal<string | null>(null);
  private pickerMap: L.Map | null = null;
  private pickerMarker: L.Marker | null = null;
  private pickerPinColor = '#f57c00';   // the POI pin colour (set to the venue's colour when pinning)
  private pickerMapRendered = false;

  // True when the picker pin is far enough from the tour's start that it
  // probably represents a mistake (e.g. GPS resolved to the wrong region).
  // Soft warning only — saving is still allowed.
  readonly outsideTourArea = computed(() => {
    const lat = this.pickerLat();
    const lng = this.pickerLng();
    const start = this.startCoords();
    if (lat == null || lng == null || !start) return false;

    const end = this.endCoords();
    const tourSpanKm = end ? haversineKm(start[0], start[1], end[0], end[1]) : 0;
    const radiusKm = Math.max(5, tourSpanKm * 2);
    return haversineKm(start[0], start[1], lat, lng) > radiusKm;
  });

  // Live soft check for the stop picker: the name of the stop's venue when the
  // current pin sits OUTSIDE that venue's drawn area, else null. Saving is still
  // allowed — this is only a heads-up. Null when the venue has no drawn polygon.
  readonly outsideVenueArea = computed<string | null>(() => {
    const lat = this.pickerLat();
    const lng = this.pickerLng();
    if (lat == null || lng == null) return null;

    const stopId = this.editingStopId();
    const spaceId = this.pinningSpaceId()                 // new-POI pin flow
      ?? (stopId
        ? this.stops().find(s => s.id === stopId)?.space_id
        : this.activeSpaceId());
    if (!spaceId) return null;

    const space = this.spaces().find(sp => sp.id === spaceId);
    if (!space) return null;

    const poly = this.getSpacePolygon(space);
    if (poly.length < 3) return null;   // no drawn area to compare against

    return this.pointInPolygon(lat, lng, poly) ? null : space.name;
  });


  // ── Init ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Geocoding with debounce — the tour start/end address fields (step 2) only.
    this.geoSub = this.geocode$.pipe(
      debounceTime(400),
      switchMap(({ query, target }) => {
        if (query.length < 3) {
          if (target === 'start') { this.startSuggestions.set([]); this.startNoResults.set(false); }
          else                    { this.endSuggestions.set([]);   this.endNoResults.set(false); }
          return of(null);
        }
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
        return this.http.get<any[]>(url).pipe(switchMap(results => of({ target, results })));
      }),
    ).subscribe(data => {
      if (!data) return;
      const suggestions = data.results.map((r: any) => ({
        display_name: r.display_name,
        lat: +r.lat,
        lon: +r.lon,
        boundingbox: r.boundingbox,
      }));
      const empty = suggestions.length === 0;
      if (data.target === 'start') { this.startSuggestions.set(suggestions); this.startNoResults.set(empty); }
      else                         { this.endSuggestions.set(suggestions);   this.endNoResults.set(empty); }
    });

    const id = this.routeTourId;
    if (id) {
      this.loading.set(true);
      this.api.get<any>(`/studio/tours/${id}`).subscribe({
        next: (tour) => {
          this.tour.set(tour);
          this.form.patchValue({
            title: tour.title,
            description: tour.description || '',
            price_euros: ((tour.price_cents ?? 0) / 100).toFixed(2),
            setting: tour.setting || '',
            duration_minutes: tour.duration_minutes,
          });
          if (Array.isArray(tour.tags)) this.tourTags.set(tour.tags);
          if (tour.cover_image_url) this.coverUrl.set(tour.cover_image_url);
          if (tour.cover_gradient && this.gradientIds.includes(tour.cover_gradient)) {
            this.coverGradient.set(tour.cover_gradient);
          }
          if (tour.presentation_audio_url) this.presentationAudioUrl.set(tour.presentation_audio_url);
          if (tour.latitude && tour.longitude) {
            this.startCoords.set([Number(tour.latitude), Number(tour.longitude)]);
          }
          if (tour.end_latitude && tour.end_longitude) {
            this.endCoords.set([Number(tour.end_latitude), Number(tour.end_longitude)]);
          }
          // Restore committed addresses + their input text, and derive a city so
          // the street field is enabled (the saved address doesn't store the town).
          if (tour.start_address) {
            this.startAddress.set(tour.start_address);
            this.startAddressInput.set(tour.start_address);
          }
          if (tour.end_address) {
            this.endAddress.set(tour.end_address);
            this.endAddressInput.set(tour.end_address);
          }
          if (tour.start_address && tour.end_address && tour.start_address === tour.end_address) {
            this.sameAddress.set(true);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

      // Load variants to find original variant
      this.api.get<any[]>(`/studio/tours/${id}/variants`).subscribe(variants => {
        const original = variants.find((v: any) => v.is_original);
        if (original) {
          this.variantId.set(original.id);
          this.loadStops();
        }
      });
    } else {
      // New tour: prefill the required title so the field is never blank, then
      // ask for the title up-front in a small modal before the Basics flow.
      const preset = this.route.snapshot.queryParamMap.get('title')?.trim() ?? '';
      this.titleDraft.set(preset);
      this.form.controls.title.setValue(preset || 'My tour');
      this.showTitlePrompt.set(true);
    }
  }

  // ── Guided field flow ──────────────────────────────────────────────────
  // Scrolls a field into view, focuses it and selects its (pre-filled) text so
  // the creator can immediately type over it. Driven by the per-field "next"
  // buttons in the Basics tab.
  // Per-field "Next" buttons flip to "Edit" once used, so the creator can hop
  // back to a field they've already moved past.
  readonly fieldAdvanced = signal<Record<string, boolean>>({});
  advance(key: string, nextId: string): void {
    this.focusAndSelect(nextId);
    this.fieldAdvanced.update(m => ({ ...m, [key]: true }));
  }

  focusAndSelect(id: string): void {
    // Small delay so a field revealed by the same click is in the DOM first.
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector('#' + id) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      try { (el as HTMLInputElement).select?.(); } catch { /* not selectable */ }
    }, 40);
  }

  // After a tab is saved: scroll back up to the tabs, then focus + select the
  // first editable field of the now-active step.
  private afterTabAdvance(): void {
    setTimeout(() => {
      this.host.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const el = this.host.nativeElement.querySelector(
        'input[type="text"], input[type="number"], input[type="email"], textarea',
      ) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) {
        el.focus({ preventScroll: true });
        try { (el as HTMLInputElement).select?.(); } catch { /* not selectable */ }
      }
    }, 350);
  }

  ngOnDestroy(): void {
    this.geoSub?.unsubscribe();
    this.map?.remove();
    this.reviewMap?.remove();
    this.pickerMap?.remove();
    this.venuePickerMap?.remove();
    this.clearPendingCover();
  }

  ngAfterViewInit(): void {
    if (this.isNew()) {
      // Land in the title prompt first; if it's already dismissed, the inline
      // title field instead.
      setTimeout(() => {
        const promptEl = this.titlePromptInput()?.nativeElement;
        if (this.showTitlePrompt() && promptEl) { promptEl.focus(); promptEl.select(); }
        else this.heroTitle()?.nativeElement.focus();
      });
    }
  }

  ngAfterViewChecked(): void {
    if (this.step() === 2 && !this.mapRendered) {
      setTimeout(() => this.renderMap());
    }
    if (this.step() !== 2 && this.mapRendered) {
      this.map?.remove();
      this.map = null;
      this.startMarker = null;
      this.endMarker = null;
      this.mapRendered = false;
    }
    if (this.step() === 4 && !this.reviewMapRendered) {
      setTimeout(() => this.renderReviewMap());
    }
    if (this.step() !== 4 && this.reviewMapRendered) {
      this.reviewMap?.remove();
      this.reviewMap = null;
      this.reviewMapRendered = false;
    }
    if (this.locationPickerOpen() && !this.pickerMapRendered) {
      setTimeout(() => this.renderPickerMap());
    }
    if (this.venuePickerOpen() && !this.venuePickerMapRendered) {
      setTimeout(() => this.renderVenuePickerMap());
    }
  }

  /** Read-only overview map for the Review step: draws every venue's outlined
   *  area and every stop's pin, plus the tour start/end for context. */
  private renderReviewMap(): void {
    const el = document.getElementById('review-map');
    if (!el || this.reviewMapRendered) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });

    this.reviewMap = L.map(el, { scrollWheelZoom: false });
    this.reviewMap.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');

    const theme = this.mapThemes.find(t => t.id === this.activeTheme()) ?? this.mapThemes[0];
    L.tileLayer(theme.url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
    } as any).addTo(this.reviewMap);

    const bounds: L.LatLngExpression[] = [];

    // Tour start/end context dots.
    const start = this.startCoords();
    const end   = this.endCoords();
    if (start) {
      L.circleMarker(start, { radius: 6, color: '#1a1a1a', fillColor: '#1a1a1a', fillOpacity: 0.7, weight: 2 })
        .addTo(this.reviewMap).bindTooltip('Tour start');
      bounds.push(start);
    }
    if (end) {
      L.circleMarker(end, { radius: 6, color: '#666666', fillColor: '#666666', fillOpacity: 0.7, weight: 2 })
        .addTo(this.reviewMap).bindTooltip('Tour end');
      bounds.push(end);
    }

    // Each venue's area (in its own colour), then its stops' pins (matching colour).
    this.spaces().forEach((space, si) => {
      const color = this.spaceColor(space);
      const poly = this.getSpacePolygon(space);
      if (poly.length >= 3) {
        L.polygon(poly as any, { color, fillColor: color, weight: 2, fillOpacity: 0.22 })
          .addTo(this.reviewMap!).bindTooltip(`${si + 1}. ${space.name}`);
        poly.forEach(p => bounds.push(p));
      }

      this.getStopsForSpace(space.id).forEach((stop, i) => {
        if (stop.latitude == null || stop.longitude == null) return;
        const latlng: L.LatLngExpression = [Number(stop.latitude), Number(stop.longitude)];
        L.marker(latlng, { icon: this.colorPinIcon(color) }).addTo(this.reviewMap!)
          .bindTooltip(`${si + 1}.${i + 1} ${stop.title}`);
        bounds.push(latlng);
      });
    });

    // Stops with coordinates but no venue (legacy / unassigned).
    this.getStopsForSpace(null).forEach(stop => {
      if (stop.latitude == null || stop.longitude == null) return;
      const latlng: L.LatLngExpression = [Number(stop.latitude), Number(stop.longitude)];
      L.marker(latlng).addTo(this.reviewMap!).bindTooltip(stop.title);
      bounds.push(latlng);
    });

    // Fit to the venues + stops with a little margin. Run once now and again on
    // the next frame with invalidateSize(), because the tab was just revealed and
    // the container may still measure 0 at first paint (which would zoom way out).
    const fit = () => {
      if (!this.reviewMap) return;
      this.reviewMap.invalidateSize();
      if (bounds.length === 1) {
        this.reviewMap.setView(bounds[0] as any, 16);
      } else if (bounds.length > 1) {
        this.reviewMap.fitBounds(L.latLngBounds(bounds as any), { padding: [20, 20], maxZoom: 17 });
      } else {
        this.reviewMap.setView([20, 0], 2);
      }
    };
    fit();
    requestAnimationFrame(fit);

    this.reviewMapRendered = true;
  }

  private renderMap(): void {
    const el = document.getElementById('tour-map');
    if (!el || this.mapRendered) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });

    // The tour-location map is a fixed, non-zoomable preview: pins are placed
    // only by address/current-location, so all zoom interactions are disabled.
    this.map = L.map(el, {
      scrollWheelZoom: false,
      zoomControl: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      preferCanvas: true,
    });
    this.map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');

    const theme = this.mapThemes.find(t => t.id === this.activeTheme()) ?? this.mapThemes[0];
    L.tileLayer(theme.url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
      subdomains: theme.url.includes('cartocdn') ? 'abcd' : 'abc',
      crossOrigin: 'anonymous',
    } as any).addTo(this.map);

    const sc = this.startCoords();
    const ec = this.sameAddress() ? sc : this.endCoords();

    if (sc && ec && (ec[0] !== sc[0] || ec[1] !== sc[1])) {
      this.map.fitBounds(L.latLngBounds(sc, ec), { padding: [60, 60] });
    } else if (sc) {
      this.map.setView(sc, 13);
    } else {
      this.map.setView([41.9028, 12.4964], 5);
    }

    if (sc) this.placeStartMarker(sc[0], sc[1]);
    if (!this.sameAddress() && ec) this.placeEndMarker(ec[0], ec[1]);

    // Pins are placed only by choosing an address (or "use my current location").
    // The map itself is not click-to-drop and the markers are not draggable, so
    // a pin can't be moved by accident.
    this.mapRendered = true;
  }

  // Start/end pin colours, paired with the address inputs' accents so the
  // creator can tell which pin belongs to which address.
  private readonly START_PIN_COLOR = '#2b7fff';
  private readonly END_PIN_COLOR   = '#f57c00';

  private colorPinIcon(color: string): L.DivIcon {
    return L.divIcon({
      className: 'color-pin',
      html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="13" cy="13" r="4.5" fill="#ffffff"/>
      </svg>`,
      iconSize: [26, 34],
      iconAnchor: [13, 34],
      popupAnchor: [0, -30],
    });
  }

  private placeStartMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.startMarker) {
      this.startMarker.setLatLng([lat, lng]);
    } else {
      this.startMarker = L.marker([lat, lng], { draggable: false, icon: this.colorPinIcon(this.START_PIN_COLOR) })
        .addTo(this.map)
        .bindPopup('Start');
    }
  }

  private placeEndMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.endMarker) {
      this.endMarker.setLatLng([lat, lng]);
    } else {
      this.endMarker = L.marker([lat, lng], { draggable: false, icon: this.colorPinIcon(this.END_PIN_COLOR) })
        .addTo(this.map)
        .bindPopup('End');
    }
  }

  updateMap(): void {
    this.map?.remove();
    this.map = null;
    this.startMarker = null;
    this.endMarker = null;
    this.mapRendered = false;
  }

  changeMapTheme(themeId: string): void {
    this.activeTheme.set(themeId);
    this.updateMap();
  }

  useCurrentLocationForTour(): void {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!this.startCoords()) {
          this.startCoords.set([lat, lng]);
          this.placeStartMarker(lat, lng);
          this.map?.setView([lat, lng], 15);
        } else if (!this.sameAddress() && !this.endCoords()) {
          this.endCoords.set([lat, lng]);
          this.placeEndMarker(lat, lng);
          const sc = this.startCoords()!;
          this.map?.fitBounds(L.latLngBounds(sc, [lat, lng]), { padding: [60, 60] });
        }
      },
      () => { /* ignore — user can still drag or type address */ },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  // ── Step navigation ────────────────────────────────────────────────────

  goToStep(s: number): void {
    if (s >= 2 && !this.tourId()) return;    // Basics must be saved first
    if (s >= 3 && !this.step2Done()) return; // Location must be set first
    if (s >= 4 && !this.step3Done()) return; // At least one stop before publishing
    this.step.set(s);
    if (s === 3) {
      this.ensureVariant();
    }
    if (s === 4) {
      // Greet the creator with a "review before you publish" note.
      this.showPublishIntro.set(true);
    }
  }

  // ── Step 1: save tour basics ───────────────────────────────────────────

  saveBasics(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue() as Record<string, any>;
    const body: Record<string, any> = {
      title: raw['title'],
      description: raw['description'] || null,
      price_cents: Math.round(parseFloat(raw['price_euros'] || '0') * 100),
      tags: this.tourTags(),
      cover_gradient: this.coverGradient(),
    };
    if (raw['setting']) body['setting'] = raw['setting'];
    if (raw['duration_minutes'] != null) body['duration_minutes'] = raw['duration_minutes'];

    const creating = this.isNew();
    const req$ = creating
      ? this.api.post<any>('/studio/tours', body)
      : this.api.patch<any>(`/studio/tours/${this.tourId()}`, body);

    req$.subscribe({
      next: (tour) => {
        this.tour.set(tour);
        this.saving.set(false);
        // A cover chosen before the tour existed can now be uploaded.
        const pending = this.pendingCoverFile();
        if (pending) this.uploadCover(pending);
        if (creating) {
          this.router.navigate(['/studio/tours', tour.id], { replaceUrl: true });
        }
        this.goToStep(2);
        this.afterTabAdvance();
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to save tour.');
        this.saving.set(false);
      },
    });
  }

  // ── Step 2: location ────────────────────────────────────────────────────

  onAddressInput(target: 'start' | 'end', event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    // Typing only filters the list — it never commits a value. The committed
    // address/coords are cleared until the user clicks a list item.
    if (target === 'start') {
      this.startAddressInput.set(query);
      this.startAddress.set('');
      this.startCoords.set(null);
      this.startNoResults.set(false);
      if (this.startMarker) { this.startMarker.remove(); this.startMarker = null; }
    } else {
      this.endAddressInput.set(query);
      this.endAddress.set('');
      this.endCoords.set(null);
      this.endNoResults.set(false);
      if (this.endMarker) { this.endMarker.remove(); this.endMarker = null; }
    }
    this.geocode$.next({ query, target });
  }

  selectSuggestion(target: 'start' | 'end', suggestion: any): void {
    if (target === 'start') {
      this.startCoords.set([suggestion.lat, suggestion.lon]);
      this.startAddress.set(suggestion.display_name);
      this.startAddressInput.set(suggestion.display_name);
      this.startSuggestions.set([]);
      this.startNoResults.set(false);
      this.placeStartMarker(suggestion.lat, suggestion.lon);
    } else {
      this.endCoords.set([suggestion.lat, suggestion.lon]);
      this.endAddress.set(suggestion.display_name);
      this.endAddressInput.set(suggestion.display_name);
      this.endSuggestions.set([]);
      this.endNoResults.set(false);
      this.placeEndMarker(suggestion.lat, suggestion.lon);
    }
    if (this.map) {
      const sc = this.startCoords();
      const ec = this.sameAddress() ? null : this.endCoords();
      if (sc && ec && (ec[0] !== sc[0] || ec[1] !== sc[1])) {
        this.map.fitBounds(L.latLngBounds(sc, ec), { padding: [60, 60] });
      } else {
        this.map.setView([suggestion.lat, suggestion.lon], 13);
      }
    }
  }

  async saveLocation(skipWarning = false): Promise<void> {
    // Enforce "pick from the list": typed-but-unselected text isn't a real place.
    if (this.startAddressInput().trim() && !this.startAddress()) {
      this.error.set('Pick the start address from the list — it has to be a real match.');
      return;
    }
    if (!this.sameAddress() && this.endAddressInput().trim() && !this.endAddress()) {
      this.error.set('Pick the end address from the list — it has to be a real match.');
      return;
    }

    // Check if map has pinned spaces — warn before resetting
    if (!skipWarning && this.map && this.tour()?.map_image_url) {
      const hasPins = this.spaces().some(s => s.map_x != null);
      if (hasPins) {
        this.showMapResetWarning.set(true);
        return;
      }
    }

    this.showMapResetWarning.set(false);
    this.saving.set(true);
    this.error.set(null);

    // If same address, copy start to end
    if (this.sameAddress()) {
      this.endAddress.set(this.startAddress());
      this.endCoords.set(this.startCoords());
    }

    const body: Record<string, any> = {};
    const sc = this.startCoords();
    const ec = this.endCoords();
    if (sc) { body['latitude'] = sc[0]; body['longitude'] = sc[1]; }
    if (ec) { body['end_latitude'] = ec[0]; body['end_longitude'] = ec[1]; }
    if (this.startAddress()) body['start_address'] = this.startAddress();
    if (this.endAddress()) body['end_address'] = this.endAddress();

    // Capture two map screenshots: the visible square one for the in-tour
    // player modal, and a rectangular one (briefly resizing the same map) for
    // previews/listings around the rest of the site.
    if (this.map && this.startCoords()) {
      try {
        const mapEl = document.getElementById('tour-map');
        if (mapEl) {
          const controls = mapEl.querySelector('.leaflet-control-container') as HTMLElement;
          const html2canvasModule = (await import('html2canvas')).default;

          const snapshot = async (): Promise<Blob | null> => {
            if (controls) controls.style.display = 'none';
            const canvas = await html2canvasModule(mapEl, {
              useCORS: true, allowTaint: true, logging: false,
            });
            if (controls) controls.style.display = '';
            return await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
          };

          // 1. Rectangular (current, visible) — used for previews & listings.
          const rectBlob = await snapshot();

          // 2. Resize element to a square, let Leaflet redraw + new tiles load,
          //    capture the square variant for the in-tour player, then restore.
          //    An overlay hides the resize so it never flashes on screen.
          this.capturingMap.set(true);
          mapEl.classList.add('map-container--square-snap');
          this.map.invalidateSize({ animate: false });
          await new Promise(r => setTimeout(r, 700));
          const squareBlob = await snapshot();
          mapEl.classList.remove('map-container--square-snap');
          this.map.invalidateSize({ animate: false });
          // Keep the overlay until the map has settled back to its rectangle.
          await new Promise(r => setTimeout(r, 200));
          this.capturingMap.set(false);

          const formData = new FormData();
          if (rectBlob   && rectBlob.size   > 5000) formData.append('file',        rectBlob,   'map-rect.png');
          if (squareBlob && squareBlob.size > 5000) formData.append('file_square', squareBlob, 'map-square.png');

          if (formData.has('file') || formData.has('file_square')) {
            this.http.post<any>(
              `${environment.apiUrl}/studio/tours/${this.tour()!.id}/map-screenshot`,
              formData,
              { headers: { Authorization: `Bearer ${this.auth.token()}` } }
            ).subscribe({
              next: (res) => this.tour.update(t => t ? {
                ...t,
                map_image_url: res.map_image_url,
                map_image_square_url: res.map_image_square_url,
              } : t),
            });
          }
        }
      } catch (e) { console.error('Map screenshot failed:', e); this.capturingMap.set(false); }
    }

    this.api.patch<any>(`/studio/tours/${this.tour()!.id}`, body).subscribe({
      next: (tour) => {
        this.tour.set(tour);
        this.saving.set(false);
        this.goToStep(3);
        this.afterTabAdvance();
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to save location.');
        this.saving.set(false);
      },
    });
  }

  // ── Cover image ─────────────────────────────────────────────────────────

  onCoverSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file later
    if (!file) return;
    this.closeBgPicker();

    // New tour: no id yet — keep the file and show a local preview. It uploads
    // once the tour is created in saveBasics().
    if (!this.tourId()) {
      this.setPendingCover(file);
      return;
    }

    this.uploadCover(file);
  }

  private uploadCover(file: File): void {
    this.uploading.set(true);
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<any>(
      `${environment.apiUrl}/studio/tours/${this.tourId()}/cover`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: (res) => {
        this.coverUrl.set(res.cover_image_url);
        this.tour.update(t => t ? { ...t, cover_image_url: res.cover_image_url } : t);
        this.clearPendingCover();
        this.uploading.set(false);
      },
      error: () => {
        this.error.set('Failed to upload cover image.');
        this.uploading.set(false);
      },
    });
  }

  private setPendingCover(file: File): void {
    this.clearPendingCover();
    this.pendingCoverFile.set(file);
    this.pendingCoverPreview.set(URL.createObjectURL(file));
  }

  private clearPendingCover(): void {
    const prev = this.pendingCoverPreview();
    if (prev) URL.revokeObjectURL(prev);
    this.pendingCoverFile.set(null);
    this.pendingCoverPreview.set(null);
  }

  // ── Hero background picker ────────────────────────────────────────────────
  toggleBgPicker(): void { this.bgPickerOpen.update(v => !v); }
  closeBgPicker(): void { this.bgPickerOpen.set(false); }

  selectGradient(g: string): void {
    this.coverGradient.set(g);
    // The gradient becomes the visible background, so drop any current image.
    const hadImage = !!this.heroImage();
    this.clearPendingCover();
    if (this.coverUrl()) this.coverUrl.set(null);

    // Persist immediately for an existing tour (clearing the cover too if needed).
    const id = this.tourId();
    if (id) {
      const body: Record<string, any> = { cover_gradient: g };
      if (hadImage) body['cover_image_url'] = null;
      this.api.patch<any>(`/studio/tours/${id}`, body).subscribe({
        next: (tour) => this.tour.update(t => t ? { ...t, ...tour } : t),
        error: () => this.error.set('Failed to update background.'),
      });
    }
    this.closeBgPicker();
  }

  removeCoverImage(): void {
    const id = this.tourId();
    const hadSavedImage = !!this.coverUrl();
    this.clearPendingCover();
    this.coverUrl.set(null);
    if (id && hadSavedImage) {
      this.api.patch<any>(`/studio/tours/${id}`, { cover_image_url: null }).subscribe({
        next: (tour) => this.tour.update(t => t ? { ...t, ...tour } : t),
        error: () => this.error.set('Failed to remove cover image.'),
      });
    }
  }

  // ── Presentation audio ───────────────────────────────────────────────────

  onPresentationAudioSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.tourId()) return;

    this.uploadingAudio.set(true);
    const formData = new FormData();
    formData.append('file', file);

    this.http.post<any>(
      `${environment.apiUrl}/studio/tours/${this.tourId()}/presentation-audio`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: (res) => {
        this.presentationAudioUrl.set(res.presentation_audio_url);
        this.uploadingAudio.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to upload presentation audio.');
        this.uploadingAudio.set(false);
      },
    });
  }

  deletePresentationAudio(): void {
    if (!this.tourId()) return;
    this.api.delete(`/studio/tours/${this.tourId()}/presentation-audio`).subscribe({
      next: () => this.presentationAudioUrl.set(null),
      error: () => this.error.set('Failed to remove presentation audio.'),
    });
  }

  // ── Publish ─────────────────────────────────────────────────────────────

  publish(): void {
    this.publishing.set(true);
    this.error.set(null);

    this.api.post<any>(`/studio/tours/${this.tourId()}/publish`).subscribe({
      next: (result) => {
        this.tour.update(t => t ? { ...t, status: result.status } : t);
        this.publishing.set(false);
        this.router.navigate(['/studio/tours']);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to publish tour.');
        this.publishing.set(false);
      },
    });
  }

  // ── Step 3: stops editor ───────────────────────────────────────────────

  private ensureVariant(): void {
    if (this.variantId()) {
      this.loadStops();
      return;
    }

    // Check if a variant already exists before creating one
    this.api.get<any[]>(`/studio/tours/${this.tour()!.id}/variants`).subscribe(variants => {
      const original = variants.find((v: any) => v.is_original);
      if (original) {
        this.variantId.set(original.id);
        this.loadStops();
      } else {
        // Only create if none exists
        this.api.post<any>(`/studio/tours/${this.tour()!.id}/variants`, {
          language_code: 'en',
          title: this.tour()!.title,
        }).subscribe(v => {
          this.variantId.set(v.id);
          this.loadStops();
        });
      }
    });
  }

  private loadStops(): void {
    const vid = this.variantId();
    const tourId = this.tour()?.id ?? this.routeTourId;
    if (!vid || !tourId) return;
    this.api.get<any[]>(`/studio/tours/${tourId}/variants/${vid}/stops`).subscribe(
      s => this.stops.set(s)
    );
    this.api.get<any[]>(`/studio/tours/${tourId}/variants/${vid}/spaces`).subscribe(
      s => this.spaces.set(s)
    );
  }

  // ── Space methods ──────────────────────────────────────────────────────

  addSpace(): void {
    if (this.spaceForm.invalid) return;
    const vid = this.variantId();
    if (!vid) return;

    this.api.post<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces`, this.spaceForm.getRawValue()).subscribe(space => {
      this.spaces.update(s => [...s, space]);
      this.spaceForm.reset({ name: '', description: '' });
      this.addingSpace.set(false);
      // Auto-open the stop form inside the new space
      this.activeSpaceId.set(space.id);
    });
  }

  // ── Venue colour / collapse ────────────────────────────────────────────
  // Soft background "vibes" a creator can give a venue. Persisted on the space.
  readonly venueColors = [
    { name: 'Rose',   value: '#e7c9ca' },
    { name: 'Sand',   value: '#e8ddc7' },
    { name: 'Sage',   value: '#cdd8c6' },
    { name: 'Sky',    value: '#c7d6e0' },
    { name: 'Lilac',  value: '#d7cce2' },
    { name: 'Clay',   value: '#e2cdc2' },
    { name: 'Mint',   value: '#c8e0d4' },
    { name: 'Slate',  value: '#d0d4d9' },
  ];
  readonly colorMenuFor    = signal<string | null>(null);
  readonly collapsedSpaces = signal<Set<string>>(new Set());

  /** The colour a newly-created venue gets — sequential through the palette so
   *  it's distinct from (and never matches) the previous venue. */
  private defaultVenueColor(): string {
    const idx = this.spaces().length;
    return this.venueColors[idx % this.venueColors.length].value;
  }

  /** A venue's colour for drawing (falls back to its palette slot if unset). */
  spaceColor(space: any): string {
    if (space?.color) return space.color;
    const idx = this.spaces().findIndex(s => s.id === space?.id);
    return this.venueColors[(idx >= 0 ? idx : 0) % this.venueColors.length].value;
  }

  /** The colour of the venue immediately before this one (for the "can't match
   *  the previous venue" rule), or null if it's the first venue. */
  previousVenueColor(space: any): string | null {
    const list = this.spaces();
    const idx = list.findIndex(s => s.id === space?.id);
    return idx > 0 ? this.spaceColor(list[idx - 1]) : null;
  }

  toggleColorMenu(spaceId: string): void {
    this.colorMenuFor.update(v => v === spaceId ? null : spaceId);
  }

  setVenueColor(space: any, color: string): void {
    const vid = this.variantId();
    // A venue can't take the same colour as the one before it.
    if (color === this.previousVenueColor(space)) return;
    this.colorMenuFor.set(null);
    if (!vid) return;
    this.api.patch<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces/${space.id}`, { color })
      .subscribe(updated => this.spaces.update(s => s.map(sp => sp.id === space.id ? updated : sp)));
  }

  isCollapsed(spaceId: string): boolean { return this.collapsedSpaces().has(spaceId); }

  toggleCollapse(spaceId: string): void {
    this.collapsedSpaces.update(s => {
      const next = new Set(s);
      next.has(spaceId) ? next.delete(spaceId) : next.add(spaceId);
      return next;
    });
  }

  // Draft name shared by the (mutually-exclusive) "New venue" bars, so the save
  // button can mute itself until something is typed.
  readonly venueDraft = signal('');
  submitVenue(): void {
    const name = this.venueDraft().trim();
    if (!name) return;
    this.addVenueQuick(name);
    this.venueDraft.set('');
    this.addingVenue.set(false);
  }

  // Quick-add a venue from the compact "New venue" bar (name only).
  addVenueQuick(name: string): void {
    const n = name.trim();
    if (!n) return;
    const vid = this.variantId();
    if (!vid) return;
    this.api.post<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces`, { name: n, description: '', color: this.defaultVenueColor() })
      .subscribe(space => this.spaces.update(s => [...s, space]));
  }

  // Deleting a venue also deletes the stops inside it, so confirm first.
  readonly venuePendingDelete = signal<any | null>(null);

  requestDeleteVenue(space: any): void { this.venuePendingDelete.set(space); }
  cancelDeleteVenue(): void { this.venuePendingDelete.set(null); }
  confirmDeleteVenue(): void {
    const space = this.venuePendingDelete();
    this.venuePendingDelete.set(null);
    if (space) this.deleteSpace(space.id);
  }

  deleteSpace(spaceId: string): void {
    const vid = this.variantId();
    if (!vid) return;
    this.api.delete(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces/${spaceId}`).subscribe(() => {
      this.spaces.update(s => s.filter(x => x.id !== spaceId));
      this.loadStops(); // reload stops — the venue's stops were deleted with it
    });
  }

  getStopsForSpace(spaceId: string | null): any[] {
    return this.stops().filter(s => s.space_id === spaceId);
  }

  addStop(): void {
    if (this.stopForm.invalid) return;
    const vid = this.variantId();
    if (!vid) return;

    const currentSpaceId = this.activeSpaceId();
    const body = { ...this.stopForm.getRawValue(), space_id: currentSpaceId };
    this.api.post<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops`, body).subscribe(stop => {
      this.loadStops(); // reload to get proper ordering and space data
      this.stopForm.reset({ title: '', description: '', latitude: null, longitude: null });
      // Keep the form open in the same space for sequential adding
    });
  }

  // Quick-add a stop from the compact "new stop title" bar (title only; the
  // stop can be expanded with description, location and media afterwards).
  addStopQuick(spaceId: string, title: string): void {
    const t = title.trim();
    if (!t) return;
    const vid = this.variantId();
    if (!vid) return;
    this.api.post<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops`, { title: t, space_id: spaceId })
      .subscribe((created) => {
        this.loadStops();
        this.addingPoiFor.set(null);
        // Offer to drop a single location pin for the POI right after naming it.
        this.pinPromptStop.set({ id: created.id, title: t, space_id: spaceId });
      });
  }

  /** Dismiss the "pin this POI?" prompt without placing a pin. */
  dismissPinPrompt(): void {
    this.pinPromptStop.set(null);
  }

  /** "Yes" on the pin prompt: open the picker seeded on the POI's venue so the
   *  creator can drop one pin inside the area, then land back on its card. */
  startStopPin(): void {
    const poi = this.pinPromptStop();
    if (!poi) return;
    this.pinningStopId.set(poi.id);
    this.pinningSpaceId.set(poi.space_id);
    this.editingStopId.set(null);

    // Open with NO pin — each stop gets its own fresh pin. The map is framed on
    // the venue area (renderPickerMap fits to pinningSpaceId's polygon), and the
    // creator clicks to drop this stop's single pin.
    this.pickerLat.set(null);
    this.pickerLng.set(null);

    this.pinPromptStop.set(null);
    this.pickerError.set(null);
    this.pickerLocating.set(false);
    this.locationPickerOpen.set(true);
    this.pickerMapRendered = false;
  }

  /** Add or replace an existing stop's pin. Reuses the direct-save pin flow, and
   *  seeds the stop's current pin (if any) so it can be dragged/re-placed. */
  repinStop(stop: any): void {
    this.pinningStopId.set(stop.id);
    this.pinningSpaceId.set(stop.space_id);
    this.editingStopId.set(null);

    if (stop.latitude != null && stop.longitude != null) {
      this.pickerLat.set(Number(stop.latitude));
      this.pickerLng.set(Number(stop.longitude));
    } else {
      this.pickerLat.set(null);
      this.pickerLng.set(null);
    }

    this.pickerError.set(null);
    this.pickerLocating.set(false);
    this.locationPickerOpen.set(true);
    this.pickerMapRendered = false;
  }

  /** Inline-edit a point of interest's text description (saved on blur). */
  updateStopDescription(stop: any, event: Event): void {
    const text = (event.target as HTMLTextAreaElement).value.slice(0, 2000);
    if (text === (stop.description ?? '')) return;   // nothing changed
    const vid = this.variantId();
    if (!vid) return;
    this.api.patch<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops/${stop.id}`, { description: text })
      .subscribe({
        next: (updated) => this.stops.update(s => s.map(x => x.id === stop.id ? { ...x, ...updated } : x)),
        error: () => this.error.set('Failed to save the text.'),
      });
  }

  editStop(stop: any): void {
    this.editingStopId.set(stop.id);
    this.stopForm.patchValue({
      title: stop.title,
      description: stop.description || '',
      latitude:  stop.latitude  != null ? Number(stop.latitude)  : null,
      longitude: stop.longitude != null ? Number(stop.longitude) : null,
    });
  }

  saveStop(): void {
    const stopId = this.editingStopId();
    if (!stopId || this.stopForm.invalid) return;
    const vid = this.variantId();
    if (!vid) return;

    const body = this.stopForm.getRawValue();
    this.api.patch<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops/${stopId}`, body).subscribe(updated => {
      this.stops.update(s => s.map(x => x.id === stopId ? { ...x, ...updated } : x));
      this.editingStopId.set(null);
      this.stopForm.reset({ title: '', description: '', latitude: null, longitude: null });
    });
  }

  cancelEdit(): void {
    this.editingStopId.set(null);
    this.stopForm.reset({ title: '', description: '', latitude: null, longitude: null });
  }

  // ── Location picker ────────────────────────────────────────────────────
  openLocationPicker(): void {
    const formLat = this.stopForm.value.latitude  ?? null;
    const formLng = this.stopForm.value.longitude ?? null;

    // Only pre-place a pin if THIS stop already has its own coordinates. Otherwise
    // open with no pin so the creator drops a fresh one — never show another stop's
    // (or the tour start's) pin as if it belonged here.
    if (formLat != null && formLng != null) {
      this.pickerLat.set(formLat);
      this.pickerLng.set(formLng);
    } else {
      this.pickerLat.set(null);
      this.pickerLng.set(null);
    }

    this.pickerError.set(null);
    this.pickerLocating.set(false);
    this.locationPickerOpen.set(true);
    this.pickerMapRendered = false;
  }

  closeLocationPicker(): void {
    this.locationPickerOpen.set(false);
    this.pickerMap?.remove();
    this.pickerMap = null;
    this.pickerMarker = null;
    this.pickerMapRendered = false;
    this.pinningStopId.set(null);
    this.pinningSpaceId.set(null);
  }

  saveStopLocation(): void {
    const lat = this.pickerLat();
    const lng = this.pickerLng();
    if (lat == null || lng == null) {
      this.pickerError.set('Place a pin on the map first.');
      return;
    }

    // New-POI pin flow: persist the pin straight to the stop, then return to its
    // card so the creator can carry on to media upload.
    const pinStopId = this.pinningStopId();
    if (pinStopId) {
      const vid = this.variantId();
      if (!vid) return;
      this.api.patch<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops/${pinStopId}`, {
        latitude:  Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
      }).subscribe({
        next: (updated) => {
          this.stops.update(s => s.map(x => x.id === pinStopId ? { ...x, ...updated } : x));
          this.closeLocationPicker();
          // Scroll the POI's card into view — its media upload controls live there.
          setTimeout(() => {
            document.getElementById('poi-' + pinStopId)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 120);
        },
        error: () => this.pickerError.set('Failed to save the location.'),
      });
      return;
    }

    this.stopForm.patchValue({
      latitude:  Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    });
    this.checkStopArea(lat, lng);
    this.closeLocationPicker();
  }

  /** Soft check: warn (don't block) if the stop falls outside its venue's area. */
  private checkStopArea(lat: number, lng: number): void {
    this.stopAreaWarning.set(null);
    const stopId = this.editingStopId();
    if (!stopId) return;
    const stop = this.stops().find(s => s.id === stopId);
    const space = stop ? this.spaces().find(sp => sp.id === stop.space_id) : null;
    if (!space) return;
    const poly = this.getSpacePolygon(space);
    if (poly.length >= 3 && !this.pointInPolygon(lat, lng, poly)) {
      this.stopAreaWarning.set(`Heads up — this point sits outside “${space.name}”'s drawn area.`);
    }
  }

  clearStopLocation(): void {
    this.stopForm.patchValue({ latitude: null, longitude: null });
  }

  useCurrentLocation(): void {
    if (!('geolocation' in navigator)) {
      this.pickerError.set('Geolocation is not supported by this browser.');
      return;
    }
    this.pickerError.set(null);
    this.pickerLocating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.pickerLat.set(latitude);
        this.pickerLng.set(longitude);
        this.pickerLocating.set(false);
        if (this.pickerMap) {
          this.updatePickerMarker(latitude, longitude);
          this.pickerMap.panTo([latitude, longitude]);
        }
      },
      (err) => {
        this.pickerLocating.set(false);
        const msg = err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Allow location access or place the pin manually.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Location unavailable. Try again or place the pin manually.'
            : err.code === err.TIMEOUT
              ? 'Location request timed out. Try again.'
              : 'Could not determine your location.';
        this.pickerError.set(msg);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  private renderPickerMap(): void {
    const el = document.getElementById('stop-location-map');
    if (!el || this.pickerMapRendered) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });

    this.pickerMap = L.map(el, { zoomControl: true, scrollWheelZoom: true });
    this.pickerMap.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');

    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
    } as any).addTo(this.pickerMap);

    // Show the tour endpoints as small static dots for context.
    const start = this.startCoords();
    const end   = this.endCoords();
    if (start) {
      L.circleMarker(start, {
        radius: 7, color: '#1a1a1a', fillColor: '#1a1a1a', fillOpacity: 0.7, weight: 2,
      }).addTo(this.pickerMap).bindTooltip('Tour start');
    }
    if (end) {
      L.circleMarker(end, {
        radius: 7, color: '#666666', fillColor: '#666666', fillOpacity: 0.7, weight: 2,
      }).addTo(this.pickerMap).bindTooltip('Tour end');
    }

    // When pinning a POI inside a venue, draw that venue's outline so the creator
    // can see the area they should place the pin within.
    const pinSpaceId = this.pinningSpaceId();
    const pinSpace = pinSpaceId ? this.spaces().find(sp => sp.id === pinSpaceId) : null;
    const venueColor = pinSpace ? this.spaceColor(pinSpace) : '#f57c00';
    const venuePoly = pinSpace ? this.getSpacePolygon(pinSpace) : [];
    if (venuePoly.length >= 3) {
      L.polygon(venuePoly as any, { color: venueColor, fillColor: venueColor, weight: 2, fillOpacity: 0.18, dashArray: '4 4' })
        .addTo(this.pickerMap)
        .bindTooltip(`${pinSpace!.name} area`);
    }
    this.pickerPinColor = venueColor;   // the POI pin takes the venue's colour

    // Initial view: venue outline if it has one, else the stop's own pin, else
    // the tour start (there's no address search anymore, so start is the anchor).
    const stopLat = this.pickerLat();
    const stopLng = this.pickerLng();

    if (venuePoly.length >= 3) {
      this.pickerMap.fitBounds(L.latLngBounds(venuePoly as any), { padding: [40, 40], maxZoom: 18 });
    } else if (stopLat != null && stopLng != null) {
      this.pickerMap.setView([stopLat, stopLng], 16);
    } else if (start) {
      this.pickerMap.setView(start, 16);
    } else if (end) {
      this.pickerMap.setView(end, 16);
    } else {
      this.pickerMap.setView([20, 0], 2);
    }

    if (stopLat != null && stopLng != null) {
      this.updatePickerMarker(stopLat, stopLng);
    }

    this.pickerMap.on('click', (e: L.LeafletMouseEvent) => {
      this.pickerLat.set(e.latlng.lat);
      this.pickerLng.set(e.latlng.lng);
      this.updatePickerMarker(e.latlng.lat, e.latlng.lng);
    });

    this.pickerMapRendered = true;
    setTimeout(() => this.pickerMap?.invalidateSize(), 100);
  }

  private updatePickerMarker(lat: number, lng: number): void {
    if (!this.pickerMap) return;
    if (!this.pickerMarker) {
      this.pickerMarker = L.marker([lat, lng], { draggable: true, icon: this.colorPinIcon(this.pickerPinColor) }).addTo(this.pickerMap);
      this.pickerMarker.on('drag', (e: L.LeafletEvent) => {
        const ll = (e.target as L.Marker).getLatLng();
        this.pickerLat.set(ll.lat);
        this.pickerLng.set(ll.lng);
      });
    } else {
      this.pickerMarker.setLatLng([lat, lng]);
    }
  }

  deleteStop(stopId: string): void {
    const vid = this.variantId();
    if (!vid) return;
    this.api.delete(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops/${stopId}`).subscribe(() => {
      this.stops.update(s => s.filter(x => x.id !== stopId));
    });
  }

  moveStop(index: number, direction: -1 | 1): void {
    const vid = this.variantId();
    if (!vid) return;
    const current = [...this.stops()];
    const target = index + direction;
    if (target < 0 || target >= current.length) return;

    [current[index], current[target]] = [current[target], current[index]];
    const order = current.map((s, i) => ({ id: s.id, order_index: i }));

    this.api.post(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops/reorder`, { order }).subscribe(() => {
      this.stops.set(current.map((s, i) => ({ ...s, order_index: i })));
    });
  }

  // ── Transitions ────────────────────────────────────────────────────────

  saveTransition(stopId: string, toStopId: string, durationMinutes: string, description: string): void {
    const vid = this.variantId();
    if (!vid) return;

    this.api.put<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops/${stopId}/transition`, {
      to_stop_id: toStopId,
      duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
      description: description || null,
    }).subscribe(() => this.loadStops());
  }

  removeTransition(stopId: string): void {
    const vid = this.variantId();
    if (!vid) return;
    this.api.delete(`/studio/tours/${this.tour()!.id}/variants/${vid}/stops/${stopId}/transition`).subscribe(
      () => this.loadStops()
    );
  }

  // ── Space transitions ──────────────────────────────────────────────────

  saveSpaceTransition(spaceId: string, toSpaceId: string, durationMinutes: string, description: string): void {
    const vid = this.variantId();
    if (!vid) return;

    this.api.put<any>(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces/${spaceId}/transition`, {
      to_space_id: toSpaceId,
      duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
      description: description || null,
    }).subscribe(() => this.loadStops());
  }

  removeSpaceTransition(spaceId: string): void {
    const vid = this.variantId();
    if (!vid) return;
    this.api.delete(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces/${spaceId}/transition`).subscribe(
      () => this.loadStops()
    );
  }

  // ── Media upload (Cloudinary) ───────────────────────────────────────────

  onMediaSelect(stopId: string, mediaType: 'audio' | 'image' | 'pdf', event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);

    this.http.post<any>(
      `${environment.apiUrl}/studio/stops/${stopId}/media/upload`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: () => this.loadStops(),
      error: () => {
        this.error.set(`${mediaType === 'audio' ? 'Audio' : 'Image'} upload failed. Please try again.`);
      },
    });
  }

  uploadRecordedAudio(stopId: string, file: File): void {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', 'audio');

    this.http.post<any>(
      `${environment.apiUrl}/studio/stops/${stopId}/media/upload`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: () => this.loadStops(),
      error: () => this.error.set('Audio upload failed. Please try again.'),
    });
  }

  updateMediaCaption(stopId: string, mediaId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const caption = input.value.trim().slice(0, 80);
    this.api.patch<any>(`/studio/stops/${stopId}/media/${mediaId}`, { caption }).subscribe({
      next: () => this.loadStops(),
      error: () => this.error.set('Failed to save caption.'),
    });
  }

  uploadRecordedPresentation(file: File): void {
    if (!this.tourId()) return;
    const formData = new FormData();
    formData.append('file', file);

    this.uploadingAudio.set(true);
    this.http.post<any>(
      `${environment.apiUrl}/studio/tours/${this.tourId()}/presentation-audio`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: (res) => {
        this.presentationAudioUrl.set(res.presentation_audio_url);
        this.uploadingAudio.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to upload presentation audio.');
        this.uploadingAudio.set(false);
      },
    });
  }

  deleteMedia(stopId: string, mediaId: string): void {
    this.api.delete(`/studio/stops/${stopId}/media/${mediaId}`).subscribe(() => this.loadStops());
  }
}
