import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../admin-api.service';

export interface MediaItem {
  url: string;
  public_id: string;
  width: number;
  height: number;
  bytes: number;
  resource_type?: 'video' | 'image';
  /** Images only — the hero text colour used while this still is on screen. */
  text_color?: 'dark' | 'light';
}

export type Slot = 'desktop_video' | 'mobile_video' | 'mobile_image';

type SlotData = Record<Slot, MediaItem[]>;

interface SlotMeta {
  slot: Slot;
  kind: 'video' | 'image';
  title: string;
  hint: string;
  emptyHint: string;
  accept: string;
  portraitPreview: boolean;
}

@Component({
  selector: 'app-admin-homepage-media',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-homepage-media.component.html',
  styleUrl: './admin-homepage-media.component.scss',
})
export class AdminHomepageMediaComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly slotMeta: SlotMeta[] = [
    {
      slot: 'desktop_video',
      kind: 'video',
      title: 'Desktop video',
      hint: 'Must be landscape. Loops through the clips in order. Max 100 MB each.',
      emptyHint: 'No clips yet — the bundled clip is shown.',
      accept: 'video/mp4,video/*',
      portraitPreview: false,
    },
    {
      slot: 'mobile_video',
      kind: 'video',
      title: 'Phone video',
      hint: 'Must be portrait. Max 100 MB each.',
      emptyHint: 'No clips yet — the desktop clips are used instead.',
      accept: 'video/mp4,video/*',
      portraitPreview: true,
    },
    {
      slot: 'mobile_image',
      kind: 'image',
      title: 'Phone images',
      hint: 'Shown on small screens instead of video — lighter on data and free of iOS autoplay quirks. They crossfade as a slideshow. Max 10 MB each.',
      emptyHint: 'No images yet — the images bundled with the site are used.',
      accept: 'image/*',
      portraitPreview: false,
    },
  ];

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<SlotData>({ desktop_video: [], mobile_video: [], mobile_image: [] });

  // Per-slot transient UI state.
  readonly selected  = signal<Partial<Record<Slot, File | null>>>({});
  readonly uploading = signal<Partial<Record<Slot, boolean>>>({});
  readonly slotError = signal<Partial<Record<Slot, string | null>>>({});

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<SlotData>('/homepage-media').subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  items(slot: Slot): MediaItem[] { return this.data()[slot] ?? []; }
  isUploading(slot: Slot): boolean { return !!this.uploading()[slot]; }
  pickedName(slot: Slot): string { return this.selected()[slot]?.name ?? 'Choose file…'; }
  errorFor(slot: Slot): string | null { return this.slotError()[slot] ?? null; }

  onPick(slot: Slot, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selected.update(s => ({ ...s, [slot]: input.files?.[0] ?? null }));
    this.slotError.update(s => ({ ...s, [slot]: null }));
  }

  upload(slot: Slot): void {
    const file = this.selected()[slot];
    if (!file || this.isUploading(slot)) return;

    const fd = new FormData();
    fd.append('file', file);

    this.uploading.update(s => ({ ...s, [slot]: true }));
    this.slotError.update(s => ({ ...s, [slot]: null }));

    this.api.upload<MediaItem[]>(`/homepage-media/${slot}`, fd).subscribe({
      next: (items) => {
        this.uploading.update(s => ({ ...s, [slot]: false }));
        this.selected.update(s => ({ ...s, [slot]: null }));
        this.data.update(d => ({ ...d, [slot]: items }));
      },
      error: (e) => {
        this.uploading.update(s => ({ ...s, [slot]: false }));
        this.slotError.update(s => ({ ...s, [slot]: e.error?.error ?? 'Upload failed' }));
      },
    });
  }

  remove(slot: Slot, item: MediaItem): void {
    if (!confirm('Delete this item from the homepage?')) return;
    this.slotError.update(s => ({ ...s, [slot]: null }));
    this.api.deleteBody<MediaItem[]>(`/homepage-media/${slot}`, { public_id: item.public_id }).subscribe({
      next: (items) => this.data.update(d => ({ ...d, [slot]: items })),
      error: (e) => this.slotError.update(s => ({ ...s, [slot]: e.error?.error ?? 'Delete failed' })),
    });
  }

  /** Flip the hero title between dark and light text while this still shows. */
  setTextColor(slot: Slot, item: MediaItem, textColor: 'dark' | 'light'): void {
    if (item.text_color === textColor) return;
    this.api.patch<MediaItem[]>(`/homepage-media/${slot}`, {
      public_id: item.public_id,
      text_color: textColor,
    }).subscribe({
      next: (items) => this.data.update(d => ({ ...d, [slot]: items })),
      error: (e) => this.slotError.update(s => ({ ...s, [slot]: e.error?.error ?? 'Could not save' })),
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
  }
}
