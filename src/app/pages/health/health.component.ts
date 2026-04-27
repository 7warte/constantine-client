import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type HealthState = 'idle' | 'loading' | 'ok' | 'error';

@Component({
  selector: 'app-health',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './health.component.html',
  styleUrl: './health.component.scss',
})
export class HealthComponent implements OnInit {
  private readonly http = inject(HttpClient);

  // /health is mounted at the API root, not under /api
  protected readonly healthUrl =
    environment.apiUrl.replace(/\/api\/?$/, '') + '/health';

  readonly state         = signal<HealthState>('idle');
  readonly response      = signal<unknown>(null);
  readonly errorMessage  = signal<string | null>(null);
  readonly httpStatus    = signal<number | null>(null);
  readonly latencyMs     = signal<number | null>(null);
  readonly lastCheckedAt = signal<Date | null>(null);

  ngOnInit(): void {
    this.check();
  }

  check(): void {
    this.state.set('loading');
    this.response.set(null);
    this.errorMessage.set(null);
    this.httpStatus.set(null);
    this.latencyMs.set(null);

    const started = performance.now();

    this.http.get(this.healthUrl, { observe: 'response' }).subscribe({
      next: (res) => {
        this.latencyMs.set(Math.round(performance.now() - started));
        this.lastCheckedAt.set(new Date());
        this.httpStatus.set(res.status);
        this.response.set(res.body);
        this.state.set('ok');
      },
      error: (err: HttpErrorResponse) => {
        this.latencyMs.set(Math.round(performance.now() - started));
        this.lastCheckedAt.set(new Date());
        this.httpStatus.set(err.status || null);
        this.errorMessage.set(err.message);
        this.response.set(err.error ?? null);
        this.state.set('error');
      },
    });
  }
}
