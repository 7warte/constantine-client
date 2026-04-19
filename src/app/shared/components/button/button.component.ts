import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type"
      [class]="classes"
      [disabled]="disabled || loading"
      [attr.aria-busy]="loading"
    >
      @if (loading) {
        <span class="btn__spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size:    ButtonSize    = 'md';
  @Input() type:    'button' | 'submit' | 'reset' = 'button';
  @Input() loading  = false;
  @Input() disabled = false;
  @Input() block    = false;

  get classes(): string {
    return [
      'btn',
      `btn--${this.variant}`,
      `btn--${this.size}`,
      this.block    ? 'btn--block'    : '',
      this.loading  ? 'btn--loading'  : '',
      this.disabled ? 'btn--disabled' : '',
    ].filter(Boolean).join(' ');
  }
}
