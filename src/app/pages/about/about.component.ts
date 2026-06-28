import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { BadgeIconComponent } from '../../shared/components/badge-icon/badge-icon.component';
import { BADGES, BadgeDef } from '../../core/badges/badge-catalog';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, ButtonComponent, BadgeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  /** A handful of badges to showcase on the About page. */
  readonly sampleBadges: BadgeDef[] = ['marco-polo', 'wagner', 'shakespeare', 'mansa-musa', 'cleopatra']
    .map(id => BADGES.find(b => b.id === id)!)
    .filter(Boolean);

  scrollTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
