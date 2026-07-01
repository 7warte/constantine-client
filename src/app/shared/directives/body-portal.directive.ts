import { Directive, ElementRef, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Moves the host element to <body> so a position:fixed overlay covers the whole
 * viewport instead of being trapped inside a transformed / overflow-clipped /
 * lower-stacked ancestor (e.g. the Material sidenav content in the Studio).
 * Angular keeps managing the element and its bindings after the DOM move; it is
 * removed again when the host is destroyed.
 */
@Directive({ selector: '[appBodyPortal]', standalone: true })
export class BodyPortalDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.appendChild(this.el.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.el.nativeElement.remove();
  }
}
