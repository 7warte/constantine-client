import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../admin-api.service';

interface JobRow {
  id: string;
  tour_id: string;
  tour_title: string;
  target_language_code: string;
  compensation_type: string;
  compensation_value: number;
  status: 'open' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'cancelled';
  application_count: number;
  requester_username: string;
  requester_name: string | null;
  translator_username: string | null;
  translator_name: string | null;
  created_at: string;
  invite_accepted_at: string | null;
}

@Component({
  selector: 'app-admin-translation-jobs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-translation-jobs.component.html',
  styleUrl: './admin-translation-jobs.component.scss',
})
export class AdminTranslationJobsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly rows    = signal<JobRow[]>([]);
  readonly statusFilter = signal<string>('');

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<JobRow[]>('/translation-jobs', { status: this.statusFilter() }).subscribe({
      next: (rs)      => { this.rows.set(rs); this.loading.set(false); },
      error: (e: any) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmtCompensation(r: JobRow): string {
    if (r.compensation_type === 'fixed') return `€${(r.compensation_value / 100).toFixed(2)}`;
    if (r.compensation_type === 'revshare') return `${r.compensation_value}% rev share`;
    return `${r.compensation_value}`;
  }
}
