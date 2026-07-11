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

  ngOnInit(): void {
    this.api.get<any[]>('/purchases').subscribe({
      next: (p) => { this.purchases.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
