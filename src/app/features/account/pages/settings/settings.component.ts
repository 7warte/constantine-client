import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly api    = inject(ApiService);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  readonly deleting = signal(false);
  readonly confirm  = signal(false);

  deleteAccount(): void {
    if (!this.confirm()) { this.confirm.set(true); return; }
    this.deleting.set(true);
    this.api.delete('/users/me').subscribe({
      next: () => { this.auth.logout(); this.router.navigate(['/']); },
      error: () => this.deleting.set(false),
    });
  }
}
