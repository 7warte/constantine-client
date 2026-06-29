import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { DEMO_TOUR } from '../../demo-tour';

@Component({
  selector: 'app-blueprint',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatExpansionModule, MatIconModule],
  templateUrl: './blueprint.component.html',
  styleUrl: './blueprint.component.scss',
})
export class BlueprintComponent {
  readonly tour = DEMO_TOUR;

  // Purpose reminder shown when the page opens.
  readonly showIntro = signal(true);
  closeIntro(): void { this.showIntro.set(false); }
}
