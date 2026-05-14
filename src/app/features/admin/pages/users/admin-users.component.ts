import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../admin-api.service';

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  purchase_count: number;
  tour_count: number;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly rows    = signal<UserRow[]>([]);

  readonly search    = signal('');
  readonly suspended = signal<string>('');

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<UserRow[]>('/users', {
      search: this.search().trim(),
      suspended: this.suspended(),
    }).subscribe({
      next: (rs)      => { this.rows.set(rs); this.loading.set(false); },
      error: (e: any) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
