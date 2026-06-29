import {
  ChangeDetectionStrategy, Component, OnInit, ElementRef, inject, signal, computed, viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';

type PromoKind = 'tour' | 'creator';
type PromoMedium = 'print' | 'digital';
type PrintSize = 'a4' | 'a5' | 'a6';
type DigitalFormat = 'square' | 'story';

interface PromoOption {
  kind: PromoKind;
  medium: PromoMedium;
  icon: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-promote',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule],
  templateUrl: './promote.component.html',
  styleUrl: './promote.component.scss',
})
export class PromoteComponent implements OnInit {
  private readonly api  = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly creator = this.auth.user;
  readonly tours   = signal<any[]>([]);
  readonly loading = signal(true);

  // `medium` is always set — it drives the Printable/Digital switch at the top
  // and which options are shown. `kind` stays null until an option is picked,
  // which is what reveals the builder.
  readonly kind           = signal<PromoKind | null>(null);
  readonly medium         = signal<PromoMedium>('print');
  readonly selectedTourId = signal<string>('');
  readonly variantId      = signal<string | null>(null);
  readonly printSize      = signal<PrintSize>('a5');
  readonly digitalFormat  = signal<DigitalFormat>('square');
  readonly qrDataUrl      = signal<string | null>(null);
  readonly busy           = signal(false);
  readonly copied         = signal(false);
  // Mobile-only: shows the rendered promo card in a full-screen modal so it's
  // actually legible (it's cramped inline on a phone).
  readonly showPreview    = signal(false);

  readonly printSizes: PrintSize[] = ['a4', 'a5', 'a6'];

  readonly options: PromoOption[] = [
    { kind: 'tour',    medium: 'print',   icon: 'confirmation_number', title: 'Tour presentation',   desc: 'A printable voucher for one tour, with a QR code to its booking page.' },
    { kind: 'creator', medium: 'print',   icon: 'storefront',          title: 'Creator presentation', desc: 'A printable flyer for your whole showcase — all your tours, one QR code.' },
    { kind: 'tour',    medium: 'digital', icon: 'ad_units',            title: 'Single tour campaign', desc: 'A social-ready image for one tour to post on Instagram, TikTok or Facebook.' },
    { kind: 'creator', medium: 'digital', icon: 'share',               title: 'Creator showcase',     desc: 'A social-ready image promoting you and all of your tours.' },
  ];

  readonly preview = viewChild<ElementRef<HTMLElement>>('preview');

  readonly selectedTour = computed(() => this.tours().find(t => t.id === this.selectedTourId()) ?? null);
  readonly featuredTours = computed(() => this.tours().slice(0, 4));
  readonly chosen = computed(() => this.kind() !== null);
  readonly chosenOption = computed(() => this.options.find(o => this.isActive(o)) ?? null);
  // Options shown for the currently-selected medium (Printable or Digital).
  readonly visibleOptions = computed(() => this.options.filter(o => o.medium === this.medium()));

  readonly targetUrl = computed(() => {
    const origin = window.location.origin;
    if (this.kind() === 'tour') {
      const vid = this.variantId();
      const tour = this.selectedTour();
      // The public tour page needs both the variant id (route) and tour id (query).
      return vid && tour ? `${origin}/tours/${vid}?tourId=${tour.id}` : '';
    }
    const username = this.creator()?.username;
    return username ? `${origin}/creators/${username}` : '';
  });

  ngOnInit(): void {
    this.api.get<any[]>('/studio/tours').subscribe({
      next: (rows) => {
        // Prefer published tours; fall back to everything so the page is usable early.
        const published = rows.filter(t => t.status === 'published');
        this.tours.set(published.length ? published : rows);
        const first = this.tours()[0];
        if (first) this.selectedTourId.set(first.id);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  pick(option: PromoOption): void {
    this.kind.set(option.kind);
    this.medium.set(option.medium);
    this.refresh();
  }

  isActive(o: PromoOption): boolean {
    return this.kind() === o.kind && this.medium() === o.medium;
  }

  /** Switch between Printable / Digital. Keeps the chosen kind so the preview
   *  just re-renders in the new medium if a builder is already open. */
  setMedium(m: PromoMedium): void {
    if (this.medium() === m) return;
    this.medium.set(m);
    if (this.kind() !== null) this.refresh();
  }

  openPreview():  void { this.showPreview.set(true); }
  closePreview(): void { this.showPreview.set(false); }

  onTourChange(id: string): void {
    this.selectedTourId.set(id);
    this.refresh();
  }

  private refresh(): void {
    if (this.kind() === 'tour') {
      const tour = this.selectedTour();
      if (!tour) { this.variantId.set(null); this.qrDataUrl.set(null); return; }
      // The public booking URL is keyed by the original variant id.
      this.api.get<any[]>(`/studio/tours/${tour.id}/variants`).subscribe(vs => {
        const original = vs.find(v => v.is_original) ?? vs[0];
        this.variantId.set(original?.id ?? null);
        this.generateQr();
      });
    } else {
      this.variantId.set(null);
      this.generateQr();
    }
  }

  private async generateQr(): Promise<void> {
    const url = this.targetUrl();
    if (!url) { this.qrDataUrl.set(null); return; }
    const mod: any = await import('qrcode');
    const toDataURL = (mod.default ?? mod).toDataURL;
    const dataUrl = await toDataURL(url, {
      margin: 1, width: 480, color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    this.qrDataUrl.set(dataUrl);
  }

  // ── Preview helpers ──────────────────────────────────────────────────────
  price(tour: any): string {
    const c = tour?.price_cents ?? 0;
    return c > 0 ? `€${(c / 100).toFixed(2)}` : 'Free';
  }
  gradient(tour: any): string { return tour?.cover_gradient || 'g1'; }

  // ── Output ───────────────────────────────────────────────────────────────
  async copyLink(): Promise<void> {
    const url = this.targetUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch { /* clipboard blocked — ignore */ }
  }

  async download(): Promise<void> {
    const el = this.preview()?.nativeElement;
    if (!el) return;
    this.busy.set(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/png'));
      if (blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `constantine-${this.kind()}-${this.digitalFormat()}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      console.error('Promo export failed:', e);
    } finally {
      this.busy.set(false);
    }
  }

  async print(): Promise<void> {
    const el = this.preview()?.nativeElement;
    if (!el) return;
    this.busy.set(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const size = this.printSize().toUpperCase();
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(
        `<!doctype html><html><head><title>Constantine promo</title><style>`
        + `@page { size: ${size}; margin: 0; }`
        + `html,body { margin:0; padding:0; height:100%; }`
        + `img { width:100%; height:100vh; object-fit:contain; display:block; }`
        + `</style></head><body><img src="${img}" onload="window.focus();window.print();"></body></html>`
      );
      w.document.close();
    } catch (e) {
      console.error('Promo print failed:', e);
    } finally {
      this.busy.set(false);
    }
  }
}
