import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-tours-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatChipsModule,
    MatDialogModule, MatMenuModule, MatExpansionModule,
  ],
  templateUrl: './tours-list.component.html',
  styleUrl: './tours-list.component.scss',
})
export class ToursListComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly allTours = signal<any[]>([]);
  readonly loading  = signal(true);

  // Expanded tour variants
  readonly expandedTourIds = signal<Set<string>>(new Set());
  readonly variantsMap     = signal<Record<string, any[]>>({});
  readonly search   = signal('');
  readonly filter   = signal<'all' | 'published' | 'draft'>('all');

  // ── Delete state ──────────────────────────────────────────────
  readonly deleteTarget     = signal<any | null>(null);
  readonly deleteVariants   = signal<any[]>([]);
  readonly selectedVariantIds = signal<Set<string>>(new Set());
  readonly deleting         = signal(false);
  readonly deleteError      = signal<string | null>(null);
  readonly hasPurchasedVariants = computed(() => this.deleteVariants().some(v => v.purchase_count > 0));

  readonly displayedColumns = ['cover', 'title', 'status', 'language', 'downloads', 'price', 'actions'];

  readonly filteredTours = computed(() => {
    let tours = this.allTours();
    const f = this.filter();
    if (f !== 'all') tours = tours.filter(t => t.status === f);
    const s = this.search().toLowerCase();
    if (s) tours = tours.filter(t => t.title.toLowerCase().includes(s));
    return tours;
  });

  /** Flat list: tour rows interleaved with their variant child rows */
  readonly tableRows = computed(() => {
    const rows: any[] = [];
    for (const tour of this.filteredTours()) {
      rows.push({ ...tour, _type: 'tour' });
      if (this.expandedTourIds().has(tour.id)) {
        const variants = this.variantsMap()[tour.id] ?? [];
        for (const v of variants) {
          rows.push({ ...v, _type: 'variant', _tourId: tour.id });
        }
      }
    }
    return rows;
  });

  ngOnInit(): void {
    this.loadTours();
  }

  setFilter(f: 'all' | 'published' | 'draft'): void {
    this.filter.set(f);
  }

  isExpanded(tourId: string): boolean {
    return this.expandedTourIds().has(tourId);
  }

  getVariants(tourId: string): any[] {
    return this.variantsMap()[tourId] ?? [];
  }

  toggleExpand(tourId: string): void {
    const current = new Set(this.expandedTourIds());
    if (current.has(tourId)) {
      current.delete(tourId);
      this.expandedTourIds.set(current);
    } else {
      current.add(tourId);
      this.expandedTourIds.set(current);
      this.loadVariants(tourId);
    }
  }

  private loadVariants(tourId: string): void {
    this.api.get<any[]>(`/studio/tours/${tourId}/variants`).subscribe({
      next: v => this.variantsMap.update(m => ({ ...m, [tourId]: v })),
    });
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  // ── Delete flow ───────────────────────────────────────────────

  confirmDelete(tour: any): void {
    this.deleteTarget.set(tour);
    this.deleteError.set(null);
    this.deleting.set(false);
    this.selectedVariantIds.set(new Set());

    this.api.get<any[]>(`/studio/tours/${tour.id}/variants`).subscribe({
      next: variants => this.deleteVariants.set(variants),
      error: () => this.deleteVariants.set([]),
    });
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteVariants.set([]);
    this.selectedVariantIds.set(new Set());
    this.deleteError.set(null);
  }

  toggleVariant(id: string): void {
    const current = new Set(this.selectedVariantIds());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.selectedVariantIds.set(current);
  }

  deleteSelectedVariants(): void {
    const tour = this.deleteTarget();
    const ids = Array.from(this.selectedVariantIds());
    if (!tour || ids.length === 0) return;

    this.deleting.set(true);
    this.deleteError.set(null);

    forkJoin(ids.map(vid => this.api.delete(`/studio/tours/${tour.id}/variants/${vid}`))).subscribe({
      next: () => { this.deleting.set(false); this.cancelDelete(); this.loadTours(); },
      error: () => { this.deleteError.set('Failed to delete some variants.'); this.deleting.set(false); },
    });
  }

  deleteTour(): void {
    const tour = this.deleteTarget();
    if (!tour) return;

    this.deleting.set(true);
    this.deleteError.set(null);

    this.api.delete(`/studio/tours/${tour.id}`).subscribe({
      next: () => { this.deleting.set(false); this.cancelDelete(); this.loadTours(); },
      error: (err) => { this.deleteError.set(err.error?.error ?? 'Failed to delete tour.'); this.deleting.set(false); },
    });
  }

  // ── Data loading ──────────────────────────────────────────────

  private loadTours(): void {
    this.api.get<any[]>('/studio/tours').subscribe({
      next: (tours) => {
        this.allTours.set(tours);
        this.loading.set(false);

        // Auto-expand tours that have variants
        const toExpand = tours.filter(t => (t.variant_count ?? 0) > 0);
        const ids = new Set(toExpand.map(t => t.id));
        this.expandedTourIds.set(ids);
        toExpand.forEach(t => this.loadVariants(t.id));
      },
      error: () => this.loading.set(false),
    });
  }
}
