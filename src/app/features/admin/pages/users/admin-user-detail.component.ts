import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CaptchaComponent } from '../../../../shared/components/captcha/captcha.component';
import { AdminApiService } from '../../admin-api.service';

interface Purchase {
  id: string;
  amount_paid_cents: number;
  refund_status: string | null;
  refund_amount_cents: number | null;
  refunded_at: string | null;
  purchased_at: string;
  stripe_payment_intent_id: string | null;
  tour_id: string;
  tour_title: string;
  variant_language: string;
}

interface UserTour {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

interface UserDetail {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  stripe_account_id: string | null;
  purchases: Purchase[];
  tours: UserTour[];
}

type Modal = 'none' | 'suspend' | 'refund-all';

@Component({
  selector: 'app-admin-user-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, CaptchaComponent],
  templateUrl: './admin-user-detail.component.html',
  styleUrl: './admin-user-detail.component.scss',
})
export class AdminUserDetailComponent implements OnInit {
  private readonly api   = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly id      = this.route.snapshot.paramMap.get('id') ?? '';
  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<UserDetail | null>(null);

  readonly modal       = signal<Modal>('none');
  readonly suspendReason = signal('');
  readonly busy        = signal(false);
  readonly actionMsg   = signal<string | null>(null);
  readonly actionErr   = signal<string | null>(null);

  @ViewChild(CaptchaComponent) captcha?: CaptchaComponent;

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<UserDetail>(`/users/${this.id}`).subscribe({
      next: (d)       => { this.data.set(d); this.loading.set(false); },
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

  unsuspend(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.post(`/users/${this.id}/unsuspend`, {}).subscribe({
      next: () => { this.busy.set(false); this.actionMsg.set('Account reactivated.'); this.reload(); },
      error: (e: any) => { this.busy.set(false); this.actionErr.set(e.error?.error ?? 'Failed'); },
    });
  }

  async confirmSuspend(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionErr.set(null);

    const captchaToken = await this.captcha?.getToken();
    if (!captchaToken) {
      this.busy.set(false);
      this.actionErr.set('Captcha check failed. Reload and try again.');
      return;
    }

    this.api.post(`/users/${this.id}/suspend`, {
      reason: this.suspendReason().trim() || null,
      captcha_token: captchaToken,
    }).subscribe({
      next: () => {
        this.busy.set(false);
        this.modal.set('none');
        this.suspendReason.set('');
        this.actionMsg.set('Account suspended.');
        this.reload();
      },
      error: (e: any) => { this.busy.set(false); this.actionErr.set(e.error?.error ?? 'Failed'); },
    });
  }

  async confirmRefundAll(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionErr.set(null);

    const captchaToken = await this.captcha?.getToken();
    if (!captchaToken) {
      this.busy.set(false);
      this.actionErr.set('Captcha check failed. Reload and try again.');
      return;
    }

    this.api.post<{ attempted: number; results: any[] }>(`/users/${this.id}/refund-all`, {
      captcha_token: captchaToken,
    }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.modal.set('none');
        const ok = r.results.filter(x => x.ok).length;
        const fail = r.attempted - ok;
        this.actionMsg.set(
          fail === 0
            ? `Refunded ${ok} purchase(s).`
            : `Refunded ${ok}/${r.attempted} — ${fail} failed (check server logs).`
        );
        this.reload();
      },
      error: (e: any) => { this.busy.set(false); this.actionErr.set(e.error?.error ?? 'Failed'); },
    });
  }

  fmtMoney(cents: number | null): string {
    if (cents == null) return '—';
    return `€${(cents / 100).toFixed(2)}`;
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  unrefundedPaidCount(d: UserDetail): number {
    return d.purchases.filter(p => p.refund_status !== 'succeeded' && p.amount_paid_cents > 0).length;
  }
}
