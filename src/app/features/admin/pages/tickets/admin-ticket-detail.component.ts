import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService } from '../../admin-api.service';

interface Message {
  id: string;
  author_kind: 'admin' | 'user';
  body: string;
  created_at: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'archived';
  user_id: string | null;
  user_email: string | null;
  user_username: string | null;
  user_name: string | null;
  user_lookup_email: string | null;
  opened_by: 'admin' | 'user';
  cc_user: boolean;
  created_at: string;
  resolved_at: string | null;
  messages: Message[];
}

@Component({
  selector: 'app-admin-ticket-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-ticket-detail.component.html',
  styleUrl: './admin-ticket-detail.component.scss',
})
export class AdminTicketDetailComponent implements OnInit {
  private readonly api   = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly id      = this.route.snapshot.paramMap.get('id') ?? '';
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<TicketDetail | null>(null);

  readonly reply   = signal('');
  readonly sending = signal(false);
  readonly statusBusy = signal(false);

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<TicketDetail>(`/tickets/${this.id}`).subscribe({
      next: (d)       => { this.data.set(d); this.loading.set(false); },
      error: (e: any) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  send(): void {
    const body = this.reply().trim();
    if (!body || this.sending()) return;
    this.sending.set(true);
    this.api.post<Message>(`/tickets/${this.id}/messages`, { body }).subscribe({
      next: (m: Message) => {
        this.sending.set(false);
        this.reply.set('');
        this.data.update(d => d ? ({ ...d, messages: [...d.messages, m] }) : d);
      },
      error: () => { this.sending.set(false); },
    });
  }

  setStatus(status: 'open' | 'pending' | 'resolved' | 'archived'): void {
    if (this.statusBusy()) return;
    this.statusBusy.set(true);
    this.api.patch<TicketDetail>(`/tickets/${this.id}`, { status }).subscribe({
      next: (updated) => {
        this.statusBusy.set(false);
        this.data.update(d => d ? ({ ...d, status: updated.status, resolved_at: updated.resolved_at }) : d);
      },
      error: () => { this.statusBusy.set(false); },
    });
  }

  fmtDateTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-GB');
  }
}
