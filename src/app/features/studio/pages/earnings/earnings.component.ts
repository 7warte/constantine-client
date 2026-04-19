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
  readonly transactions = signal<any[]>([]);
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
    this.api.get<EarningsSummary>('/studio/earnings/summary').subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });

    this.api.get<any[]>('/studio/earnings/transactions').subscribe({
      next: (t) => this.transactions.set(t),
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
