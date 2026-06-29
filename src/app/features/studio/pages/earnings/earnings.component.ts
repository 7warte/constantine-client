import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';

interface EarningsSummary {
  total_gross: number;
  platform_fee: number;
  total_net: number;
  pending_payout: number;
}

/** Shape returned by GET /studio/earnings (amounts in cents). */
interface EarningsResponse {
  total_sales: number;
  total_revenue_cents: number;
  total_earnings_cents: number;
  breakdown: Array<{
    variant_id: string;
    language_code: string;
    tour_title: string;
    sales: number;
    earnings_cents: number;
  }> | null;
}

@Component({
  selector: 'app-earnings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './earnings.component.html',
  styleUrl: './earnings.component.scss',
})
export class EarningsComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly summary      = signal<EarningsSummary | null>(null);
  readonly breakdown    = signal<EarningsResponse['breakdown']>([]);
  readonly loading      = signal(true);

  // IBAN payout settings
  readonly iban         = signal('');
  readonly ibanSaving   = signal(false);
  readonly ibanSaved    = signal(false);
  readonly ibanError    = signal<string | null>(null);

  readonly netPct = computed(() => {
    const s = this.summary();
    if (!s || s.total_gross === 0) return 0;
    return Math.round((s.total_net / s.total_gross) * 100);
  });

  ngOnInit(): void {
    // The API reports amounts in cents; the summary cards work in euros.
    this.api.get<EarningsResponse>('/studio/earnings').subscribe({
      next: (r) => {
        const gross = (r.total_revenue_cents ?? 0) / 100;
        const net   = (r.total_earnings_cents ?? 0) / 100;
        this.summary.set({
          total_gross:    gross,
          platform_fee:   gross - net,
          total_net:      net,
          pending_payout: net,
        });
        this.breakdown.set(r.breakdown ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    // Load IBAN
    this.api.get<{ iban: string | null }>('/studio/payout-settings').subscribe({
      next: (s) => { if (s.iban) this.iban.set(s.iban); },
    });
  }

  saveIban(): void {
    this.ibanSaving.set(true);
    this.ibanError.set(null);
    this.ibanSaved.set(false);

    this.api.patch<{ iban: string }>('/studio/payout-settings', { iban: this.iban() }).subscribe({
      next: (res) => {
        this.iban.set(res.iban);
        this.ibanSaving.set(false);
        this.ibanSaved.set(true);
        setTimeout(() => this.ibanSaved.set(false), 3000);
      },
      error: (err) => {
        this.ibanError.set(err.error?.error ?? 'Failed to save IBAN.');
        this.ibanSaving.set(false);
      },
    });
  }
}
