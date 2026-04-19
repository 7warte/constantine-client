import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy, AfterViewChecked, inject,
  signal, computed,
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
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-tour-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-12px)', maxHeight: 0 }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)', maxHeight: '600px' })),
      ]),
    ]),
  ],
  imports: [ReactiveFormsModule, RouterLink, CommonModule, TagInputComponent, AudioRecorderComponent, MatIconModule],
  templateUrl: './tour-edit.component.html',
  styleUrl: './tour-edit.component.scss',
})
export class TourEditComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(ApiService);
  private readonly auth   = inject(AuthService);
  private readonly http   = inject(HttpClient);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
  readonly uploadingAudio        = signal(false);
  readonly step       = signal(1);
  readonly stops      = signal<any[]>([]);
  readonly spaces     = signal<any[]>([]);
  readonly variantId  = signal<string | null>(null);

  readonly routeTourId = this.route.snapshot.paramMap.get('tourId');
  readonly isNew       = computed(() => !this.routeTourId && !this.tour());
  readonly tourId      = computed(() => this.tour()?.id ?? this.routeTourId);
  readonly pageTitle   = computed(() => this.isNew() ? 'Create tour' : 'Edit tour');

  // ── Step 1 form ────────────────────────────────────────────────────────
  readonly form = this.fb.nonNullable.group({
    title:            ['', [Validators.required, Validators.maxLength(200)]],
    description:      ['', Validators.maxLength(2000)],
    price_euros:      ['0', [Validators.required, Validators.min(0)]],
    setting:          [''],
    duration_minutes: [null as number | null],
  });

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
  }

  readonly startAddress = signal('');
  readonly endAddress   = signal('');
  readonly startCoords  = signal<[number, number] | null>(null);
  readonly endCoords    = signal<[number, number] | null>(null);
  readonly startSuggestions = signal<any[]>([]);
  readonly endSuggestions   = signal<any[]>([]);

  private geocode$ = new Subject<{ query: string; target: 'start' | 'end' }>();
  private geoSub!: Subscription;
  private map: L.Map | null = null;
  private mapRendered = false;

  readonly mapThemes: { id: string; label: string; url: string; ext: string }[] = [
    { id: 'voyager',     label: 'Voyager',     url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'smooth',      label: 'Smooth',      url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'bright',      label: 'Bright',      url: 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'watercolor',  label: 'Watercolor',  url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', ext: 'jpg' },
    { id: 'toner',       label: 'Toner Lite',  url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'dark',        label: 'Dark',        url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', ext: 'png' },
    { id: 'osm',         label: 'Classic',     url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', ext: 'png' },
  ];
  readonly activeTheme = signal('watercolor');

  readonly showMapResetWarning = signal(false);

  // ── Map pin placement ──────────────────────────────────────────────────
  readonly pinningSpace = signal<any | null>(null);
  readonly pinX = signal(50);
  readonly pinY = signal(50);
  private isDragging = false;

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
  });
  readonly activeSpaceId     = signal<string | null>(null); // which space to add stop into
  readonly editingStopId     = signal<string | null>(null);
  readonly addingDirectionFor      = signal<string | null>(null); // stop id
  readonly addingSpaceDirectionFor = signal<string | null>(null); // space id


  // ── Init ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Geocoding with debounce
    this.geoSub = this.geocode$.pipe(
      debounceTime(400),
      switchMap(({ query, target }) => {
        if (query.length < 3) {
          if (target === 'start') this.startSuggestions.set([]);
          else this.endSuggestions.set([]);
          return of(null);
        }
        return this.http.get<any[]>(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        ).pipe(switchMap(results => of({ target, results })));
      }),
    ).subscribe(data => {
      if (!data) return;
      const suggestions = data.results.map((r: any) => ({
        display_name: r.display_name,
        lat: +r.lat,
        lon: +r.lon,
      }));
      if (data.target === 'start') this.startSuggestions.set(suggestions);
      else this.endSuggestions.set(suggestions);
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
          if (tour.presentation_audio_url) this.presentationAudioUrl.set(tour.presentation_audio_url);
          if (tour.latitude && tour.longitude) {
            this.startCoords.set([Number(tour.latitude), Number(tour.longitude)]);
          }
          if (tour.end_latitude && tour.end_longitude) {
            this.endCoords.set([Number(tour.end_latitude), Number(tour.end_longitude)]);
          }
          if (tour.start_address) this.startAddress.set(tour.start_address);
          if (tour.end_address) this.endAddress.set(tour.end_address);
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
    }
  }

  ngOnDestroy(): void {
    this.geoSub?.unsubscribe();
    this.map?.remove();
  }

  ngAfterViewChecked(): void {
    if (this.step() === 2 && this.startCoords() && !this.mapRendered) {
      setTimeout(() => this.renderMap());
    }
    if (this.step() !== 2 && this.mapRendered) {
      this.map?.remove();
      this.map = null;
      this.mapRendered = false;
    }
  }

  private renderMap(): void {
    const el = document.getElementById('tour-map');
    if (!el || this.mapRendered) return;

    const sc = this.startCoords()!;
    const ec = this.sameAddress() ? sc : (this.endCoords() ?? sc);

    // Fix Leaflet default icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
      iconUrl: 'assets/leaflet/marker-icon.png',
      shadowUrl: 'assets/leaflet/marker-shadow.png',
    });

    this.map = L.map(el, {
      scrollWheelZoom: false,
      zoomControl: false,
      preferCanvas: true,
    });

    const theme = this.mapThemes.find(t => t.id === this.activeTheme()) ?? this.mapThemes[0];
    L.tileLayer(theme.url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
      subdomains: theme.url.includes('cartocdn') ? 'abcd' : 'abc',
      crossOrigin: 'anonymous',
    } as any).addTo(this.map);

    const startMarker = L.marker([sc[0], sc[1]]).addTo(this.map).bindPopup('Start');

    if (ec[0] !== sc[0] || ec[1] !== sc[1]) {
      const endMarker = L.marker([ec[0], ec[1]]).addTo(this.map).bindPopup('End');
      const bounds = L.latLngBounds([sc[0], sc[1]], [ec[0], ec[1]]);
      this.map.fitBounds(bounds, { padding: [60, 60] }); // more padding = more zoomed out
    } else {
      this.map.setView([sc[0], sc[1]], 13); // was 15, now more zoomed out
    }

    this.mapRendered = true;
  }

  updateMap(): void {
    this.map?.remove();
    this.map = null;
    this.mapRendered = false;
  }

  changeMapTheme(themeId: string): void {
    this.activeTheme.set(themeId);
    this.updateMap();
  }

  // ── Step navigation ────────────────────────────────────────────────────

  goToStep(s: number): void {
    if (s >= 2 && !this.tourId()) return; // must save step 1 first
    this.step.set(s);
    if (s === 2) {
    }
    if (s === 3) {
      this.ensureVariant();
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
        if (creating) {
          this.router.navigate(['/studio/tours', tour.id], { replaceUrl: true });
        }
        this.goToStep(2);
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
    if (target === 'start') this.startAddress.set(query);
    else this.endAddress.set(query);
    this.geocode$.next({ query, target });
  }

  selectSuggestion(target: 'start' | 'end', suggestion: any): void {
    if (target === 'start') {
      this.startCoords.set([suggestion.lat, suggestion.lon]);
      this.startAddress.set(suggestion.display_name);
      this.startSuggestions.set([]);
    } else {
      this.endCoords.set([suggestion.lat, suggestion.lon]);
      this.endAddress.set(suggestion.display_name);
      this.endSuggestions.set([]);
    }
    this.updateMap();
  }

  async saveLocation(skipWarning = false): Promise<void> {
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

    // Capture map screenshot using Leaflet's canvas renderer
    if (this.map && this.startCoords()) {
      try {
        const sc = this.startCoords()!;
        const zoom = this.map.getZoom();
        // Use a static tile image as the map screenshot (OpenStreetMap static)
        const staticUrl = `https://staticmap.stalker2021.workers.dev/?center=${sc[0]},${sc[1]}&zoom=${zoom}&size=800x400&markers=${sc[0]},${sc[1]}`;

        // Alternatively, use html2canvas with proxy workaround
        const mapEl = document.getElementById('tour-map');
        if (mapEl) {
          const controls = mapEl.querySelector('.leaflet-control-container') as HTMLElement;
          if (controls) controls.style.display = 'none';

          const html2canvasModule = await import('html2canvas');
          const canvas = await html2canvasModule.default(mapEl, {
            useCORS: true,
            allowTaint: true,
            logging: false,
          });

          if (controls) controls.style.display = '';

          canvas.toBlob(blob => {
            if (!blob || blob.size < 5000) return; // skip if blank/tiny
            const formData = new FormData();
            formData.append('file', blob, 'map-screenshot.png');
            this.http.post<any>(
              `${environment.apiUrl}/studio/tours/${this.tour()!.id}/map-screenshot`,
              formData,
              { headers: { Authorization: `Bearer ${this.auth.token()}` } }
            ).subscribe({
              next: (res) => this.tour.update(t => t ? { ...t, map_image_url: res.map_image_url } : t),
            });
          }, 'image/png');
        }
      } catch (e) { console.error('Map screenshot failed:', e); }
    }

    this.api.patch<any>(`/studio/tours/${this.tour()!.id}`, body).subscribe({
      next: (tour) => {
        this.tour.set(tour);
        this.saving.set(false);
        this.goToStep(3);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to save location.');
        this.saving.set(false);
      },
    });
  }

  // ── Cover image ─────────────────────────────────────────────────────────

  onCoverSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.tourId()) return;

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
        this.uploading.set(false);
      },
      error: () => {
        this.error.set('Failed to upload cover image.');
        this.uploading.set(false);
      },
    });
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

  deleteSpace(spaceId: string): void {
    const vid = this.variantId();
    if (!vid) return;
    this.api.delete(`/studio/tours/${this.tour()!.id}/variants/${vid}/spaces/${spaceId}`).subscribe(() => {
      this.spaces.update(s => s.filter(x => x.id !== spaceId));
      this.loadStops(); // reload stops since their space_id was nulled
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
      this.stopForm.reset({ title: '', description: '' });
      // Keep the form open in the same space for sequential adding
    });
  }

  editStop(stop: any): void {
    this.editingStopId.set(stop.id);
    this.stopForm.patchValue({ title: stop.title, description: stop.description || '' });
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
      this.stopForm.reset({ title: '', description: '' });
    });
  }

  cancelEdit(): void {
    this.editingStopId.set(null);
    this.stopForm.reset({ title: '', description: '' });
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
