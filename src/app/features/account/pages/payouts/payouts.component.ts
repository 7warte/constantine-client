import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-payouts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './payouts.component.html',
  styleUrl: './payouts.component.scss',
})
export class PayoutsComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly payouts     = signal<any[]>([]);
  readonly loading     = signal(true);

  ngOnInit(): void {
    this.api.get<any[]>('/payouts').subscribe({
      next:  p  => { this.payouts.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
