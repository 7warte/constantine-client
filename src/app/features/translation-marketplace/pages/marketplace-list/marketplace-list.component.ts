import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-marketplace-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './marketplace-list.component.html',
  styleUrl: './marketplace-list.component.scss',
})
export class MarketplaceListComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly requests    = signal<any[]>([]);
  readonly loading     = signal(true);

  ngOnInit(): void {
    this.api.get<any[]>('/translation-requests').subscribe({
      next:  r  => { this.requests.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
