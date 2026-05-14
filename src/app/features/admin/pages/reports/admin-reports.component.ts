import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../admin-api.service';

interface ReportRow {
  id: string;
  target_type: 'tour' | 'user' | 'review';
  target_id: string;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewing' | 'dismissed' | 'actioned';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_id: string | null;
  reporter_email: string | null;
  reporter_username: string | null;
  reporter_name: string | null;
}

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss',
})
export class AdminReportsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly rows    = signal<ReportRow[]>([]);
  readonly statusFilter = signal<string>('');

  readonly editing    = signal<ReportRow | null>(null);
  readonly editStatus = signal<ReportRow['status']>('open');
  readonly editNote   = signal<string>('');
  readonly saving     = signal(false);
  readonly editError  = signal<string | null>(null);

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<ReportRow[]>('/reports', { status: this.statusFilter() }).subscribe({
      next: (rs)     => { this.rows.set(rs); this.loading.set(false); },
      error: (e: any) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  openEdit(r: ReportRow): void {
    this.editing.set(r);
    this.editStatus.set(r.status);
    this.editNote.set(r.admin_note ?? '');
    this.editError.set(null);
  }

  closeEdit(): void {
    if (this.saving()) return;
    this.editing.set(null);
  }

  save(): void {
    const r = this.editing();
    if (!r || this.saving()) return;
    this.saving.set(true);
    this.editError.set(null);
    this.api.patch<ReportRow>(`/reports/${r.id}`, {
      status: this.editStatus(),
      admin_note: this.editNote().trim(),
    }).subscribe({
      next: (updated: ReportRow) => {
        this.saving.set(false);
        this.editing.set(null);
        this.rows.update(rs => rs.map(x => x.id === updated.id ? { ...x, ...updated } : x));
      },
      error: (e: any) => {
        this.saving.set(false);
        this.editError.set(e.error?.error ?? 'Save failed');
      },
    });
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB');
  }

  reporterLabel(r: ReportRow): string {
    if (r.reporter_id) return `@${r.reporter_username ?? r.reporter_id}`;
    if (r.reporter_email) return r.reporter_email;
    return '(anonymous)';
  }
}
