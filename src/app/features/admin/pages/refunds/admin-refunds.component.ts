import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CaptchaComponent } from '../../../../shared/components/captcha/captcha.component';
import { AdminApiService } from '../../admin-api.service';

interface RefundRow {
  id: string;
  amount_paid_cents: number;
  refund_amount_cents: number | null;
  refund_status: string;
  stripe_refund_id: string | null;
  refunded_at: string | null;
  purchased_at: string;
  buyer_country: string | null;
  buyer_username: string;
  buyer_name: string | null;
  buyer_email: string;
  tour_title: string;
}

@Component({
  selector: 'app-admin-refunds',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CaptchaComponent],
  templateUrl: './admin-refunds.component.html',
  styleUrl: './admin-refunds.component.scss',
})
export class AdminRefundsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly rows    = signal<RefundRow[]>([]);

  readonly confirmRow = signal<RefundRow | null>(null);
  readonly submitting = signal(false);
  readonly actionError = signal<string | null>(null);

  @ViewChild(CaptchaComponent) captcha?: CaptchaComponent;

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<RefundRow[]>('/refunds').subscribe({
      next: (rs) => { this.rows.set(rs); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  openConfirm(row: RefundRow): void {
    this.actionError.set(null);
    this.confirmRow.set(row);
  }

  closeConfirm(): void {
    if (this.submitting()) return;
    this.confirmRow.set(null);
  }

  async confirmRefund(): Promise<void> {
    const row = this.confirmRow();
    if (!row || this.submitting()) return;
    this.submitting.set(true);
    this.actionError.set(null);

    const token = await this.captcha?.getToken();
    if (!token) {
      this.submitting.set(false);
      this.actionError.set('Captcha check failed. Reload and try again.');
      return;
    }

    this.api.post(`/refunds/${row.id}`, { captcha_token: token }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.confirmRow.set(null);
        this.reload();
      },
      error: (e) => {
        this.submitting.set(false);
        this.actionError.set(e.error?.error ?? 'Refund failed');
      },
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
}
