import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../admin-api.service';

interface TicketRow {
  id: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'archived';
  user_id: string | null;
  user_email: string | null;
  user_username: string | null;
  user_name: string | null;
  opened_by: 'admin' | 'user';
  cc_user: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_at: string | null;
}

type Modal = 'none' | 'new' | 'invite';

@Component({
  selector: 'app-admin-tickets',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-tickets.component.html',
  styleUrl: './admin-tickets.component.scss',
})
export class AdminTicketsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly rows    = signal<TicketRow[]>([]);
  readonly statusFilter = signal<string>('');

  readonly modal = signal<Modal>('none');

  // New-ticket form state
  readonly newSubject = signal('');
  readonly newBody    = signal('');
  readonly newEmail   = signal('');
  readonly newCC      = signal(false);

  // Invite form state
  readonly invEmail   = signal('');
  readonly invHint    = signal('');

  readonly busy       = signal(false);
  readonly actionMsg  = signal<string | null>(null);
  readonly actionErr  = signal<string | null>(null);

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<TicketRow[]>('/tickets', { status: this.statusFilter() }).subscribe({
      next: (rs)      => { this.rows.set(rs); this.loading.set(false); },
      error: (e: any) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  openModal(m: Modal): void {
    this.actionMsg.set(null);
    this.actionErr.set(null);
    this.modal.set(m);
  }

  closeModal(): void {
    if (this.busy()) return;
    this.modal.set('none');
  }

  createTicket(): void {
    if (this.busy()) return;
    if (!this.newSubject().trim() || !this.newBody().trim() || !this.newEmail().trim()) {
      this.actionErr.set('Subject, message and user email are required.');
      return;
    }
    this.busy.set(true);
    this.actionErr.set(null);
    this.api.post<TicketRow>('/tickets', {
      subject: this.newSubject().trim(),
      body: this.newBody().trim(),
      user_email: this.newEmail().trim(),
      cc_user: this.newCC(),
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.actionMsg.set('Ticket created.');
        this.newSubject.set(''); this.newBody.set(''); this.newEmail.set(''); this.newCC.set(false);
        this.modal.set('none');
        this.reload();
      },
      error: (e: any) => { this.busy.set(false); this.actionErr.set(e.error?.error ?? 'Failed to create'); },
    });
  }

  sendInvite(): void {
    if (this.busy()) return;
    if (!this.invEmail().trim()) {
      this.actionErr.set('User email is required.');
      return;
    }
    this.busy.set(true);
    this.actionErr.set(null);
    this.api.post('/ticket-invites', {
      user_email: this.invEmail().trim(),
      subject_hint: this.invHint().trim() || null,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.actionMsg.set('Invite email sent.');
        this.invEmail.set(''); this.invHint.set('');
        this.modal.set('none');
      },
      error: (e: any) => { this.busy.set(false); this.actionErr.set(e.error?.error ?? 'Failed to send invite'); },
    });
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
