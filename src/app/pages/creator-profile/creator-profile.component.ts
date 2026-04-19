import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { CardComponent } from '../../shared/components/card/card.component';

@Component({
  selector: 'app-creator-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardComponent],
  templateUrl: './creator-profile.component.html',
  styleUrl: './creator-profile.component.scss',
})
export class CreatorProfileComponent implements OnInit {
  private readonly api   = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly username = this.route.snapshot.paramMap.get('username') ?? '';
  readonly user     = signal<any | null>(null);
  readonly tours    = signal<any[]>([]);
  readonly loading  = signal(true);

  ngOnInit(): void {
    this.api.get<any>(`/users/${this.username}`).subscribe({
      next: u => {
        this.user.set(u);
        this.api.get<any[]>('/tours', { creator: u.id }).subscribe(t => {
          this.tours.set(t);
          this.loading.set(false);
        });
      },
      error: () => this.loading.set(false),
    });
  }
}
