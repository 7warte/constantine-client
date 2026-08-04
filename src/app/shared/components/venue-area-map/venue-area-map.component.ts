import {
  Component, Input, AfterViewInit, OnChanges, OnDestroy, SimpleChanges,
  ElementRef, ViewChild, ChangeDetectionStrategy, PLATFORM_ID, NgZone, inject, signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as L from 'leaflet';

// Leaflet builds its marker <img>s from these paths (bundler-safe copies).
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl:       'assets/leaflet/marker-icon.png',
  shadowUrl:     'assets/leaflet/marker-shadow.png',
});

export interface VenueSpace {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  polygon?: unknown;
  latitude?: number | null;
  longitude?: number | null;
  stop_count?: number | null;
}

/**
 * Read-only interactive map of a tour's venue areas: coloured polygons with
 * permanent name labels. Panning + button zoom are allowed; scroll-wheel zoom
 * is off so the map never hijacks page scrolling, and there is no editing.
 * Clicking a venue opens an info panel — its stops when a `stops` list is
 * supplied (owned tour), otherwise its description + stop count.
 */
@Component({
  selector: 'app-venue-area-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './venue-area-map.component.html',
  styleUrl: './venue-area-map.component.scss',
})
export class VenueAreaMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() spaces: VenueSpace[] = [];
  @Input() stops: any[] | null = null;                 // flat stops (owned/play view)
  @Input() start?: { lat: number; lng: number } | null;
  @Input() end?: { lat: number; lng: number } | null;

  @ViewChild('mapEl', { static: true }) mapRef!: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone       = inject(NgZone);
  private map: L.Map | null = null;

  readonly selected = signal<VenueSpace | null>(null);

  private readonly numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  roman(i: number): string { return this.numerals[i] ?? String(i + 1); }

  /** Stops that belong to the selected venue (only when a stop list was given). */
  selectedStops(): any[] {
    const sel = this.selected();
    if (!sel || !this.stops) return [];
    return this.stops.filter(s => s.space_id === sel.id);
  }

  closePanel(): void { this.selected.set(null); }

  ngAfterViewInit(): void { this.render(); }

  ngOnChanges(ch: SimpleChanges): void {
    if (this.map && (ch['spaces'] || ch['stops'] || ch['start'] || ch['end'])) this.render();
  }

  ngOnDestroy(): void { this.map?.remove(); this.map = null; }

  private render(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.map?.remove();
    this.selected.set(null);

    const map = L.map(this.mapRef.nativeElement, {
      zoomControl: true,
      scrollWheelZoom: false,   // never capture page scrolling
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener">Leaflet</a>');
    L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 20,
    } as any).addTo(map);

    const all: L.LatLngExpression[] = [];

    (this.spaces ?? []).forEach((sp, i) => {
      const color  = sp.color || '#c98a8c';
      const select = () => this.zone.run(() => this.selected.set(sp));
      const poly   = this.parsePolygon(sp.polygon);

      if (poly.length >= 3) {
        L.polygon(poly as any, { color, weight: 2, fillColor: color, fillOpacity: 0.22 })
          .addTo(map).on('click', select);
        poly.forEach(p => all.push(p));
        L.marker(this.centroid(poly) as any, { icon: this.numberIcon(this.roman(i), color) })
          .addTo(map)
          .bindTooltip(sp.name, { permanent: true, direction: 'top', offset: [0, -12], className: 'venue-area-label' })
          .on('click', select);
      } else if (sp.latitude != null && sp.longitude != null) {
        const ll: L.LatLngExpression = [+sp.latitude, +sp.longitude];
        L.marker(ll, { icon: this.numberIcon(this.roman(i), color) })
          .addTo(map)
          .bindTooltip(sp.name, { permanent: true, direction: 'top', offset: [0, -12], className: 'venue-area-label' })
          .on('click', select);
        all.push(ll);
      }
    });

    if (this.start) {
      const s: L.LatLngExpression = [this.start.lat, this.start.lng];
      L.marker(s).addTo(map).bindTooltip('Start');
      all.push(s);
    }
    if (this.end) {
      const e: L.LatLngExpression = [this.end.lat, this.end.lng];
      L.marker(e).addTo(map).bindTooltip('Finish');
      all.push(e);
    }

    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [36, 36], maxZoom: 17 });
    else map.setView([41.9028, 12.4964], 5);

    setTimeout(() => map.invalidateSize(), 60);
    this.map = map;
  }

  private numberIcon(label: string, color: string): L.DivIcon {
    return L.divIcon({
      className: 'venue-area-marker',
      html: `<span style="background:${color}">${label}</span>`,
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
  }

  private centroid(pts: [number, number][]): [number, number] {
    const n = pts.length || 1;
    const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return [sum[0] / n, sum[1] / n];
  }

  private parsePolygon(raw: unknown): [number, number][] {
    const arr = typeof raw === 'string' ? this.safeJson(raw) : raw;
    return Array.isArray(arr)
      ? arr.filter((p: any) => Array.isArray(p) && p.length === 2).map((p: any) => [+p[0], +p[1]] as [number, number])
      : [];
  }

  private safeJson(s: string): any { try { return JSON.parse(s); } catch { return null; } }
}
