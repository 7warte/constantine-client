import { Directive, HostListener } from '@angular/core';

/**
 * Selects the whole text of an input/textarea when it gains focus, so the
 * (pre-filled) value is ready to be typed over. Used across the studio tour
 * editor to make fields feel immediately editable.
 */
@Directive({
  selector: '[appSelectOnFocus]',
  standalone: true,
})
export class SelectOnFocusDirective {
  @HostListener('focus', ['$event.target'])
  onFocus(el: HTMLInputElement | HTMLTextAreaElement): void {
    // Defer to the next tick so the browser doesn't immediately collapse the
    // selection to the click caret position.
    setTimeout(() => {
      try { el.select?.(); } catch { /* not a text field */ }
    });
  }
}
