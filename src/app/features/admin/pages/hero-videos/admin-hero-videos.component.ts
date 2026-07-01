import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../admin-api.service';

interface HeroVideo {
  url: string;
  public_id: string;
  width: number;
  height: number;
  bytes: number;
}

interface HeroVideos {
  desktop: HeroVideo | null;
  mobile: HeroVideo | null;
}

type Slot = 'desktop' | 'mobile';

@Component({
  selector: 'app-admin-hero-videos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-hero-videos.component.html',
  styleUrl: './admin-hero-videos.component.scss',
})
export class AdminHeroVideosComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly slots: Slot[] = ['desktop', 'mobile'];

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<HeroVideos>({ desktop: null, mobile: null });

  // Per-slot transient UI state.
  readonly selected   = signal<{ desktop: File | null; mobile: File | null }>({ desktop: null, mobile: null });
  readonly uploading  = signal<{ desktop: boolean; mobile: boolean }>({ desktop: false, mobile: false });
  readonly slotError  = signal<{ desktop: string | null; mobile: string | null }>({ desktop: null, mobile: null });

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<HeroVideos>('/hero-videos').subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  onPick(slot: Slot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selected.update(s => ({ ...s, [slot]: file }));
    this.slotError.update(s => ({ ...s, [slot]: null }));
  }

  upload(slot: Slot): void {
    const file = this.selected()[slot];
    if (!file || this.uploading()[slot]) return;

    const fd = new FormData();
    fd.append('file', file);

    this.uploading.update(s => ({ ...s, [slot]: true }));
    this.slotError.update(s => ({ ...s, [slot]: null }));

    this.api.upload<HeroVideo>(`/hero-videos/${slot}`, fd).subscribe({
      next: () => {
        this.uploading.update(s => ({ ...s, [slot]: false }));
        this.selected.update(s => ({ ...s, [slot]: null }));
        this.reload();
      },
      error: (e) => {
        this.uploading.update(s => ({ ...s, [slot]: false }));
        this.slotError.update(s => ({ ...s, [slot]: e.error?.error ?? 'Upload failed' }));
      },
    });
  }

  remove(slot: Slot): void {
    if (!confirm('Delete this hero video? The homepage will fall back to the bundled clip.')) return;
    this.api.delete(`/hero-videos/${slot}`).subscribe({
      next: () => this.reload(),
      error: (e) => this.slotError.update(s => ({ ...s, [slot]: e.error?.error ?? 'Delete failed' })),
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
