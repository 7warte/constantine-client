import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-connect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './connect.component.html',
  styleUrl: './connect.component.scss',
})
export class ConnectComponent implements OnInit {
  private readonly api    = inject(ApiService);
  private readonly router = inject(Router);

  readonly loading  = signal(true);
  readonly status   = signal<any | null>(null);
  readonly error    = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStatus();
  }

  private loadStatus(): void {
    this.api.get<any>('/studio/connect/status').subscribe({
      next: s => { this.status.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  startOnboarding(): void {
    this.loading.set(true);
    this.api.post<{ url: string }>('/studio/connect/onboard').subscribe({
      next: res => window.location.href = res.url,
      error: () => {
        this.error.set('Failed to start onboarding. Please try again.');
        this.loading.set(false);
      },
    });
  }

  openDashboard(): void {
    this.api.post<{ url: string }>('/studio/connect/dashboard').subscribe({
      next: res => window.open(res.url, '_blank'),
      error: () => this.error.set('Failed to open Stripe dashboard.'),
    });
  }
}
