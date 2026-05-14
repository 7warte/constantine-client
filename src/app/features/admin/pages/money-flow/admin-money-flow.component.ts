import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../admin-api.service';

interface PurchaseRow {
  id: string;
  buyer_username: string;
  buyer_name: string | null;
  tour_title: string;
  variant_language: string;
  amount_paid_cents: number;
  refund_amount_cents: number | null;
  refund_status: string | null;
  buyer_country: string | null;
  buyer_currency: string | null;
  purchased_at: string;
  stripe_payment_intent_id: string | null;
}

interface PurchaseResponse {
  rows:   PurchaseRow[];
  totals: { count: number; gross_cents: number; net_cents: number; refunded_cents: number };
}

@Component({
  selector: 'app-admin-money-flow',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-money-flow.component.html',
  styleUrl: './admin-money-flow.component.scss',
})
export class AdminMoneyFlowComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);
  readonly data    = signal<PurchaseResponse | null>(null);

  // Filters
  readonly from    = signal<string>(this.defaultFrom());
  readonly to      = signal<string>(this.defaultTo());
  readonly status  = signal<'' | 'none' | 'pending' | 'refunded'>('');
  readonly country = signal<string>('');

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<PurchaseResponse>('/purchases', {
      from:    this.from(),
      to:      this.to(),
      status:  this.status(),
      country: this.country().trim().toUpperCase(),
      limit:   200,
    }).subscribe({
      next: (d)  => { this.data.set(d);  this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  resetFilters(): void {
    this.from.set(this.defaultFrom());
    this.to.set(this.defaultTo());
    this.status.set('');
    this.country.set('');
    this.reload();
  }

  fmtMoney(cents: number | null): string {
    if (cents == null) return '—';
    return `€${(cents / 100).toFixed(2)}`;
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  private defaultFrom(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }

  private defaultTo(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
