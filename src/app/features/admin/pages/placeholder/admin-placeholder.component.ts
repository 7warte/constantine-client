import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-admin-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-placeholder">
      <h1>{{ title() }}</h1>
      <p>Coming in a later phase. The page exists so the navigation feels complete.</p>
    </section>
  `,
  styles: [`
    .admin-placeholder { padding: 1.5rem; max-width: 720px; }
    .admin-placeholder h1 { font-family: var(--font-family-primary, inherit); margin-bottom: 0.5rem; }
    .admin-placeholder p  { color: #666; line-height: 1.6; }
  `],
})
export class AdminPlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title = toSignal(
    this.route.data.pipe(map(d => d['title'] ?? 'Section')),
    { initialValue: 'Section' },
  );
}
