import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-request-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ButtonComponent],
  templateUrl: './request-list.component.html',
  styleUrl: './request-list.component.scss',
})
export class RequestListComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly requests    = signal<any[]>([]);
  readonly loading     = signal(true);

  ngOnInit(): void {
    this.api.get<any[]>('/tour-requests').subscribe({
      next:  r  => { this.requests.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
