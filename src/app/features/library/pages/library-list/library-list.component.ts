import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TourDetailComponent } from '../../../../pages/tour-detail/tour-detail.component';

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

  readonly purchases = signal<any[]>([]);
  readonly loading   = signal(true);
  readonly detailsFor = signal<any | null>(null);   // purchase shown in the details modal

  readonly removing = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.api.get<any[]>('/purchases').subscribe({
      next: (p) => { this.purchases.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Remove a purchased tour from the library. This hides it (keeps ownership,
   * no refund) so it can be restored later — see DELETE /purchases/:id.
   */
  remove(purchase: any, event?: Event): void {
    event?.stopPropagation();
    if (this.removing().has(purchase.id)) return;

    const title = purchase.tour_title ?? 'this tour';
    const ok = window.confirm(
      `Remove "${title}" from your library?\n\n` +
      `You keep ownership and won't be charged again if you add it back later. ` +
      `This is not a refund.`
    );
    if (!ok) return;

    this.removing.update((s) => new Set(s).add(purchase.id));
    this.api.delete(`/purchases/${purchase.id}`).subscribe({
      next: () => {
        this.purchases.update((list) => list.filter((p) => p.id !== purchase.id));
        if (this.detailsFor()?.id === purchase.id) this.detailsFor.set(null);
        this.removing.update((s) => { const n = new Set(s); n.delete(purchase.id); return n; });
      },
      error: () => {
        this.removing.update((s) => { const n = new Set(s); n.delete(purchase.id); return n; });
        window.alert('Could not remove the tour. Please try again.');
      },
    });
  }
}
