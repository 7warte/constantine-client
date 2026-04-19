import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CommonModule],
  templateUrl: './jobs-list.component.html',
  styleUrl: './jobs-list.component.scss',
})
export class JobsListComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly jobs     = signal<any[]>([]);
  readonly requests = signal<any[]>([]);
  readonly loading  = signal(true);
  readonly tab      = signal<'available' | 'mine' | 'requests'>('available');

  ngOnInit(): void {
    this.loadData();
  }

  setTab(t: 'available' | 'mine' | 'requests'): void {
    this.tab.set(t);
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    if (this.tab() === 'requests') {
      this.api.get<any[]>('/studio/translation-requests').subscribe({
        next: r => { this.requests.set(r); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    } else if (this.tab() === 'mine') {
      this.api.get<any[]>('/jobs').subscribe({
        next: jobs => { this.jobs.set(jobs); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    } else {
      this.api.get<any[]>('/translation-requests').subscribe({
        next: jobs => { this.jobs.set(jobs); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }
  }

  getCompensation(r: any): string {
    if (r.compensation_type === 'fixed') return `€${(r.compensation_value / 100).toFixed(2)} fixed`;
    return `${r.compensation_value}% per sale`;
  }
}
