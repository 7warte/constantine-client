import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface OfflineRecord {
  purchaseId: string;
  tourId: string;
  variantId: string;
  title: string;
  sizeBytes: number;
  savedAt: number;
}

/**
 * Single-slot offline tour storage.
 *
 * One tour can be saved for offline use at a time. The small JSON the player
 * needs lives in localStorage; the heavy media (audio, images, static map) lives
 * as blobs in IndexedDB. Both work over plain http (unlike the Cache Storage API),
 * so this is testable on a phone over the local network.
 */
@Injectable({ providedIn: 'root' })
export class OfflineService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private readonly RECORD_KEY  = 'constantine.offline.record';
  private readonly JSON_PREFIX = 'constantine.offline.json.';

  private readonly browser =
    typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof indexedDB !== 'undefined';

  /** The currently-saved offline tour (or null). */
  readonly saved = signal<OfflineRecord | null>(this.loadRecord());
  /** Download progress for the tour being saved right now. */
  readonly progress = signal<{ purchaseId: string; pct: number } | null>(null);

  /** Live network state. */
  readonly online = signal(this.browser ? navigator.onLine : true);
  /** True when the device is offline AND a tour is available to fall back to. */
  readonly offlineMode = computed(() => !this.online() && !!this.saved());

  constructor() {
    if (this.browser) {
      window.addEventListener('online',  () => this.online.set(true));
      window.addEventListener('offline', () => this.online.set(false));
    }
  }

  isSaved(purchaseId: string): boolean {
    return this.saved()?.purchaseId === purchaseId;
  }

  /** Cached JSON payload for a request URL (used by the offline interceptor). */
  getJson(url: string): any | null {
    if (!this.browser) return null;
    try { const v = localStorage.getItem(this.JSON_PREFIX + url); return v ? JSON.parse(v) : null; }
    catch { return null; }
  }

  /** A blob: URL for a cached media file, or null if it isn't stored. */
  async getMediaUrl(url: string): Promise<string | null> {
    if (!this.browser) return null;
    try {
      const db = await this.openDb();
      const blob = await this.getBlob(db, url);
      return blob ? URL.createObjectURL(this.withMime(blob, url)) : null;
    } catch { return null; }
  }

  /**
   * Guarantee the blob carries a usable Content-Type. Many CDNs / signed S3
   * URLs return `application/octet-stream`, which iOS Safari refuses to decode
   * for audio — the clip "plays" but is silent. Re-wrap such blobs with a MIME
   * type inferred from the file extension so the player works on every browser.
   */
  private withMime(blob: Blob, url: string): Blob {
    const mime = this.mimeForUrl(url);
    if (!mime) return blob;
    const t = blob.type.toLowerCase();
    if (t && t !== 'application/octet-stream' && t !== 'binary/octet-stream') return blob;
    return new Blob([blob], { type: mime });
  }

  private mimeForUrl(url: string): string {
    const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? '';
    switch (ext) {
      case 'mp3':  return 'audio/mpeg';
      case 'm4a':
      case 'm4b':  return 'audio/mp4';
      case 'aac':  return 'audio/aac';
      case 'oga':
      case 'ogg':  return 'audio/ogg';
      case 'opus': return 'audio/ogg';
      case 'wav':  return 'audio/wav';
      case 'weba': return 'audio/webm';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png':  return 'image/png';
      case 'webp': return 'image/webp';
      case 'gif':  return 'image/gif';
      case 'svg':  return 'image/svg+xml';
      case 'pdf':  return 'application/pdf';
      default:     return '';
    }
  }

  /** Download everything a tour needs to play offline. Replaces any saved tour. */
  async download(purchase: any): Promise<void> {
    if (!this.browser) return;
    const purchaseId = purchase.id;
    const tourId     = purchase.tour_id;
    const variantId  = purchase.tour_variant_id;

    this.progress.set({ purchaseId, pct: 0 });
    await this.remove(false);   // single slot — clear the previous tour first

    const purchaseUrl = `${this.base}/purchases/${purchaseId}`;
    const stopsUrl    = `${this.base}/tours/${tourId}/variants/${variantId}/stops`;
    const detailUrl   = `${this.base}/tours/${tourId}/variants/${variantId}`;

    // 1. The JSON the player loads (fetched with auth via HttpClient interceptors).
    const [pData, stops, detail] = await Promise.all([
      lastValueFrom(this.http.get<any>(purchaseUrl)),
      lastValueFrom(this.http.get<any[]>(stopsUrl)),
      lastValueFrom(this.http.get<any>(detailUrl)),
    ]);
    localStorage.setItem(this.JSON_PREFIX + purchaseUrl, JSON.stringify(pData));
    localStorage.setItem(this.JSON_PREFIX + stopsUrl,    JSON.stringify(stops));
    localStorage.setItem(this.JSON_PREFIX + detailUrl,   JSON.stringify(detail));

    // 2. Collect every media URL referenced by the tour.
    const urls = new Set<string>();
    const add = (u: any) => { if (typeof u === 'string' && /^https?:\/\//.test(u)) urls.add(u); };
    add(pData?.tour_cover_image_url); add(pData?.cover_url); add(pData?.map_image_url); add(pData?.map_image_square_url);
    add(detail?.map_image_url); add(detail?.map_image_square_url); add(detail?.presentation_audio_url); add(detail?.tour_cover_image_url);
    for (const s of stops ?? []) for (const m of s.media ?? []) add(m.url);

    // 3. Fetch + store each media blob, tracking progress and total size.
    const list = [...urls];
    const db = await this.openDb();
    let done = 0, size = 0;
    for (const u of list) {
      try {
        const res = await fetch(u);
        const blob = this.withMime(await res.blob(), u);
        await this.putBlob(db, u, blob);
        size += blob.size;
      } catch { /* a failed asset is skipped — the rest of the tour still works */ }
      done++;
      this.progress.set({ purchaseId, pct: Math.round((done / Math.max(1, list.length)) * 100) });
    }

    const record: OfflineRecord = {
      purchaseId, tourId, variantId,
      title: purchase.tour_title ?? pData?.tour_title ?? 'Tour',
      sizeBytes: size + this.jsonSize([pData, stops, detail]),
      savedAt: Date.now(),
    };
    localStorage.setItem(this.RECORD_KEY, JSON.stringify(record));
    this.saved.set(record);
    this.progress.set(null);
  }

  /** Remove the saved offline tour (JSON + media blobs). */
  async remove(updateSignal = true): Promise<void> {
    if (!this.browser) return;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(this.JSON_PREFIX) || k === this.RECORD_KEY)) localStorage.removeItem(k);
    }
    try { const db = await this.openDb(); await this.clearBlobs(db); } catch { /* ignore */ }
    if (updateSignal) this.saved.set(null);
  }

  private loadRecord(): OfflineRecord | null {
    if (!this.browser) return null;
    try { const r = localStorage.getItem(this.RECORD_KEY); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }

  private jsonSize(objs: any[]): number {
    try { return objs.reduce((n, o) => n + new Blob([JSON.stringify(o)]).size, 0); }
    catch { return 0; }
  }

  // ── Minimal IndexedDB store for media blobs ────────────────────────────────
  private dbPromise?: Promise<IDBDatabase>;
  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('constantine-offline', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('media'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }
  private putBlob(db: IDBDatabase, key: string, blob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  private getBlob(db: IDBDatabase, key: string): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const r = tx.objectStore('media').get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  }
  private clearBlobs(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}
