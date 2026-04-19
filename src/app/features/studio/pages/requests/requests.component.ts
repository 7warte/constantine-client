import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-requests',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './requests.component.html',
  styleUrl: './requests.component.scss',
})
export class RequestsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly requests = signal<any[]>([]);
  readonly loading  = signal(true);

  ngOnInit(): void {
    this.api.get<any[]>('/studio/incoming-requests').subscribe({
      next: r => { this.requests.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  getCompensation(r: any): string {
    if (r.compensation_type === 'fixed') {
      return `€${(r.compensation_value / 100).toFixed(2)} fixed`;
    }
    return `${r.compensation_value}% per sale`;
  }
}
