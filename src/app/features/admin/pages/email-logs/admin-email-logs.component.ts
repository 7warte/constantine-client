import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../admin-api.service';

interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  user_id: string | null;
  created_at: string;
}

interface EmailResponse { rows: EmailRow[]; total: number; }
interface Facets { templates: string[]; statuses: string[]; }

@Component({
  selector: 'app-admin-email-logs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-email-logs.component.html',
  styleUrl: './admin-email-logs.component.scss',
})
export class AdminEmailLogsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<EmailResponse | null>(null);
  readonly facets  = signal<Facets>({ templates: [], statuses: [] });

  readonly from     = signal<string>(this.defaultFrom());
  readonly to       = signal<string>(this.defaultTo());
  readonly status   = signal<string>('');
  readonly template = signal<string>('');
  readonly search   = signal<string>('');
  readonly expanded = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<Facets>('/email-logs/facets').subscribe({
      next: (f) => this.facets.set(f),
    });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<EmailResponse>('/email-logs', {
      from: this.from(),
      to: this.to(),
      status: this.status(),
      template: this.template(),
      search: this.search().trim(),
      limit: 200,
    }).subscribe({
      next: (d)  => { this.data.set(d); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  resetFilters(): void {
    this.from.set(this.defaultFrom());
    this.to.set(this.defaultTo());
    this.status.set('');
    this.template.set('');
    this.search.set('');
    this.reload();
  }

  toggleExpand(id: string): void {
    this.expanded.update(curr => curr === id ? null : id);
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB');
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
