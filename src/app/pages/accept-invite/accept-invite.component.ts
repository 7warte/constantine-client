import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-accept-invite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './accept-invite.component.html',
  styleUrl: './accept-invite.component.scss',
})
export class AcceptInviteComponent implements OnInit {
  private readonly api    = inject(ApiService);
  readonly auth           = inject(AuthService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token    = this.route.snapshot.paramMap.get('token') ?? '';
  readonly invite   = signal<any | null>(null);
  readonly loading  = signal(true);
  readonly accepting = signal(false);
  readonly accepted  = signal(false);
  readonly error     = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<any>(`/translation-requests/invite/${this.token}`).subscribe({
      next: inv => {
        this.invite.set(inv);
        this.loading.set(false);

        // If already accepted, show that
        if (inv.invite_accepted_at) {
          this.accepted.set(true);
        }
      },
      error: () => {
        this.error.set('Invitation not found or has expired.');
        this.loading.set(false);
      },
    });
  }

  accept(): void {
    this.accepting.set(true);
    this.error.set(null);

    this.api.post<any>(`/translation-requests/invite/${this.token}/accept`).subscribe({
      next: () => {
        this.accepted.set(true);
        this.accepting.set(false);
      },
      error: err => {
        this.error.set(err.error?.error ?? 'Failed to accept invitation.');
        this.accepting.set(false);
      },
    });
  }

  getCompensationText(): string {
    const inv = this.invite();
    if (!inv) return '';
    if (inv.compensation_type === 'fixed') {
      return `€${(inv.compensation_value / 100).toFixed(2)} fixed fee`;
    }
    return `${inv.compensation_value}% of each sale`;
  }
}
