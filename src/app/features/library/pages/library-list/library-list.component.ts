import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-library-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CommonModule],
  templateUrl: './library-list.component.html',
  styleUrl: './library-list.component.scss',
})
export class LibraryListComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly purchases = signal<any[]>([]);
  readonly loading   = signal(true);

  ngOnInit(): void {
    this.api.get<any[]>('/purchases').subscribe({
      next: (p) => { this.purchases.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
