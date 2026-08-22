import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DEMO_TOUR, type DemoStop } from '../../demo-tour';
import { BodyPortalDirective } from '../../../../shared/directives/body-portal.directive';

@Component({
  selector: 'app-blueprint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule, BodyPortalDirective],
  templateUrl: './blueprint.component.html',
  styleUrl: './blueprint.component.scss',
})
export class BlueprintComponent {
  readonly tour = DEMO_TOUR;

  // Purpose reminder shown when the page opens.
  readonly showIntro = signal(true);
  closeIntro(): void { this.showIntro.set(false); }

  // The itinerary mirrors the real player: exactly one stop is open at a time.
  // Start on the first stop so the anatomy of a stop is visible on arrival.
  readonly openStop = signal<string>(DEMO_TOUR.venues[0]?.stops[0]?.numeral ?? '');

  isOpen(stop: DemoStop): boolean {
    return this.openStop() === stop.numeral;
  }

  selectStop(stop: DemoStop): void {
    this.openStop.update(cur => cur === stop.numeral ? '' : stop.numeral);
  }
}
