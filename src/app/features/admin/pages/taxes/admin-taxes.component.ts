import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-admin-taxes',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-taxes.component.html',
  styleUrl: './admin-taxes.component.scss',
})
export class AdminTaxesComponent {
  private readonly http = inject(HttpClient);

  readonly from = signal<string>(this.defaultFrom());
  readonly to   = signal<string>(this.defaultTo());
  readonly downloading = signal(false);
  readonly error       = signal<string | null>(null);

  setQuarter(q: 1 | 2 | 3 | 4): void {
    const year   = new Date().getFullYear();
    const startM = (q - 1) * 3;            // 0=Jan, 3=Apr, 6=Jul, 9=Oct
    const start  = new Date(year, startM, 1);
    const end    = new Date(year, startM + 3, 0);   // last day of the quarter
    this.from.set(toIsoDate(start));
    this.to.set(toIsoDate(end));
  }

  setYTD(): void {
    const now = new Date();
    this.from.set(toIsoDate(new Date(now.getFullYear(), 0, 1)));
    this.to.set(toIsoDate(now));
  }

  download(): void {
    if (this.downloading()) return;
    this.error.set(null);
    this.downloading.set(true);

    const url = `${environment.apiUrl}/admin/taxes/export?from=${this.from()}&to=${this.to()}`;
    this.http.get(url, { withCredentials: true, responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `vat-${this.from()}_to_${this.to()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      },
      error: (e) => {
        this.downloading.set(false);
        this.error.set(e.error?.error ?? 'Export failed');
      },
    });
  }

  private defaultFrom(): string {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return toIsoDate(d);
  }
  private defaultTo(): string {
    return toIsoDate(new Date());
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
