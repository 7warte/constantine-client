import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BadgeIconComponent } from '../../shared/components/badge-icon/badge-icon.component';
import { AuthService } from '../../core/services/auth.service';
import { BadgeService } from '../../core/badges/badge.service';
import {
  BADGE_CATEGORY_LABELS, BadgeCategory, BadgeStatus,
} from '../../core/badges/badge-catalog';

interface BadgeGroup { category: BadgeCategory; label: string; badges: BadgeStatus[]; }

@Component({
  selector: 'app-badges',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BadgeIconComponent],
  templateUrl: './badges.component.html',
  styleUrl: './badges.component.scss',
})
export class BadgesComponent implements OnInit {
  readonly auth   = inject(AuthService);
  readonly badges = inject(BadgeService);

  readonly groups = computed<BadgeGroup[]>(() => {
    const order: BadgeCategory[] = ['explorer', 'loyalty', 'creator', 'translator'];
    const all = this.badges.statuses();
    return order.map(category => ({
      category,
      label: BADGE_CATEGORY_LABELS[category],
      badges: all.filter(s => s.def.category === category),
    }));
  });

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) this.badges.load();
  }
}
