import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ChangeDetectionStrategy, ElementRef, ViewChild, SimpleChanges,
} from '@angular/core';
import * as L from 'leaflet';

// Fix Leaflet default marker icon paths (known Angular/webpack bundler issue)
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl:       'assets/leaflet/marker-icon.png',
  shadowUrl:     'assets/leaflet/marker-shadow.png',
});

export interface MapTour {
  tour_id: string;
  variant_id: string;
  title: string;
  cover_image_url: string | null;
  latitude: number;
  longitude: number;
  creator_username: string;
  price_cents: number;
}

@Component({
  selector: 'app-tour-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tour-map.component.html',
  styleUrl: './tour-map.component.scss',
})
export class TourMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() tours: MapTour[] = [];
  @ViewChild('mapContainer', { static: true }) mapRef!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;
  private markerLayer = L.layerGroup();

  ngAfterViewInit(): void {
    this.initMap();
    this.updateMarkers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['tours'] && this.map) {
      this.updateMarkers();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map(this.mapRef.nativeElement, {
      center: [41.9028, 12.4964],
      zoom: 4,
      scrollWheelZoom: true,
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1.0,
      minZoom: 2,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      noWrap: true,
    }).addTo(this.map);

    this.markerLayer.addTo(this.map);
  }

  private updateMarkers(): void {
    this.markerLayer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    for (const tour of this.tours) {
      const latlng: L.LatLngExpression = [tour.latitude, tour.longitude];
      bounds.push(latlng);

      const imgHtml = tour.cover_image_url
        ? `<img class="map-popup__img" src="${tour.cover_image_url}" alt="" />`
        : '';

      const priceStr = tour.price_cents === 0
        ? 'Free'
        : `\u20AC${(tour.price_cents / 100).toFixed(2)}`;

      const popup = L.popup().setContent(`
        <div class="map-popup">
          ${imgHtml}
          <span class="map-popup__title">${tour.title}</span>
          <div class="map-popup__meta">by ${tour.creator_username} &middot; ${priceStr}</div>
          <a class="map-popup__link" href="/tours/${tour.variant_id}?tourId=${tour.tour_id}">View tour &rarr;</a>
        </div>
      `);

      L.marker(latlng).bindPopup(popup).addTo(this.markerLayer);
    }

    if (bounds.length > 0 && this.map) {
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 12 });
    }
  }
}
