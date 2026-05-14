import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../admin-api.service';

interface ErrorRow {
  id: string;
  message: string;
  stack: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  user_id: string | null;
  user_agent: string | null;
  ip: string | null;
  metadata: any;
  created_at: string;
}

interface ErrorResponse { rows: ErrorRow[]; total: number; }
interface Facets { methods: string[]; statuses: number[]; }

@Component({
  selector: 'app-admin-error-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-error-logs.component.html',
  styleUrl: './admin-error-logs.component.scss',
})
export class AdminErrorLogsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<ErrorResponse | null>(null);
  readonly facets  = signal<Facets>({ methods: [], statuses: [] });

  readonly from   = signal<string>(this.defaultFrom());
  readonly to     = signal<string>(this.defaultTo());
  readonly method = signal<string>('');
  readonly status = signal<string>('');
  readonly search = signal<string>('');
  readonly expanded = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<Facets>('/error-logs/facets').subscribe({
      next: (f) => this.facets.set(f),
    });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<ErrorResponse>('/error-logs', {
      from: this.from(),
      to: this.to(),
      method: this.method(),
      status: this.status(),
      search: this.search().trim(),
      limit: 200,
    }).subscribe({
      next: (d: any)  => { this.data.set(d); this.loading.set(false); },
      error: (e: any) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  resetFilters(): void {
    this.from.set(this.defaultFrom());
    this.to.set(this.defaultTo());
    this.method.set('');
    this.status.set('');
    this.search.set('');
    this.reload();
  }

  toggleExpand(id: string): void {
    this.expanded.update(curr => curr === id ? null : id);
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB');
  }

  statusClass(code: number | null): string {
    if (code == null) return '';
    if (code >= 500) return 'error-logs__chip--5xx';
    if (code >= 400) return 'error-logs__chip--4xx';
    return '';
  }

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }

  private defaultTo(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
