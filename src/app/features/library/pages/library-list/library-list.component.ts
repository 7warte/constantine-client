import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { OfflineService } from '../../../../core/offline/offline.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TourDetailComponent } from '../../../../pages/tour-detail/tour-detail.component';

type LibraryTab = 'all' | 'offline';

@Component({
  selector: 'app-library-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CommonModule, EmptyStateComponent, TourDetailComponent],
  templateUrl: './library-list.component.html',
  styleUrl: './library-list.component.scss',
})
export class LibraryListComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly offline = inject(OfflineService);

  readonly purchases = signal<any[]>([]);
  readonly loading   = signal(true);
  readonly detailsFor = signal<any | null>(null);   // purchase shown in the details modal
  readonly tab = signal<LibraryTab>('all');

  // The Offline tab shows only the tour currently saved for offline use.
  readonly offlineTours = computed(() => {
    const rec = this.offline.saved();
    return rec ? this.purchases().filter(p => p.id === rec.purchaseId) : [];
  });

  ngOnInit(): void {
    this.api.get<any[]>('/purchases').subscribe({
      next: (p) => { this.purchases.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  isDownloading(purchase: any): boolean {
    return this.offline.progress()?.purchaseId === purchase.id;
  }

  async download(purchase: any): Promise<void> {
    try { await this.offline.download(purchase); }
    catch { /* swallow — a partial download still leaves the tour usable */ }
  }

  async removeOffline(): Promise<void> {
    await this.offline.remove();
    if (this.tab() === 'offline' && this.offlineTours().length === 0) this.tab.set('all');
  }

  fmtSize(bytes: number | undefined): string {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
}
