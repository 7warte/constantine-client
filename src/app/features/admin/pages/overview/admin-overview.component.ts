import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface OverviewData {
  user_count: number;
  tour_count: number;
  purchase_count: number;
}

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
})
export class AdminOverviewComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly loading = signal(true);
  readonly data    = signal<OverviewData | null>(null);
  readonly error   = signal<string | null>(null);

  ngOnInit(): void {
    this.http.get<OverviewData>(`${environment.apiUrl}/admin/overview`, { withCredentials: true }).subscribe({
      next: (d)   => { this.data.set(d); this.loading.set(false); },
      error: (e)  => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }
}
