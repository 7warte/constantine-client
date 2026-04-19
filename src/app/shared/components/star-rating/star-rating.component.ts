import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stars" [class.stars--interactive]="interactive" [attr.aria-label]="label()">
      @for (star of stars; track $index) {
        <span
          class="stars__star"
          [class.stars__star--filled]="$index < displayValue()"
          [class.stars__star--hover]="interactive && hoverValue > 0 && $index < hoverValue"
          (mouseenter)="interactive && (hoverValue = $index + 1)"
          (mouseleave)="interactive && (hoverValue = 0)"
          (click)="select($index + 1)"
        >★</span>
      }
      @if (count !== null) {
        <span class="stars__count">({{ count }})</span>
      }
    </div>
  `,
  styleUrl: './star-rating.component.scss',
})
export class StarRatingComponent {
  @Input() rating: number | null = null;
  @Input() count:  number | null = null;
  @Input() interactive = false;
  @Output() ratingChange = new EventEmitter<number>();

  readonly stars = [0, 1, 2, 3, 4];
  hoverValue = 0;

  displayValue(): number {
    if (this.hoverValue > 0) return this.hoverValue;
    return Math.round(this.rating ?? 0);
  }

  label(): string { return `${this.rating ?? 0} out of 5 stars`; }

  select(value: number): void {
    if (!this.interactive) return;
    this.rating = value;
    this.ratingChange.emit(value);
  }
}
