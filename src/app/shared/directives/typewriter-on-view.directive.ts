import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Splits the host element's text into per-character spans and reveals them
 * one-by-one with a stagger when the element enters the viewport (one-shot).
 * Preserves nested elements (e.g. <br>, <span>) and word wrapping.
 */
@Directive({
  selector: '[appTypewriter]',
  standalone: true,
  host: {
    'class': 'typewriter',
    '[class.typewriter--in]': 'visible()',
    '[style.--typewriter-step]': 'stepCss',
  },
})
export class TypewriterOnViewDirective implements OnInit, OnDestroy {
  private readonly el         = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);

  /** Per-character delay in ms. Override for longer/shorter text. */
  @Input('appTypewriter') step: number | string = 35;

  readonly visible = signal(false);
  private observer: IntersectionObserver | null = null;
  private processed = false;

  get stepCss(): string {
    const n = typeof this.step === 'string' ? Number(this.step) : this.step;
    return `${Number.isFinite(n) && n > 0 ? n : 35}ms`;
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.visible.set(true);
      return;
    }

    this.wrapChars();

    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.visible.set(true);
            this.observer?.disconnect();
            this.observer = null;
            break;
          }
        }
      },
      { threshold: 0.4, rootMargin: '0px 0px -5% 0px' },
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  // Walk the element's child nodes, replacing each text node with a sequence
  // of <span class="typewriter__char"> elements. Element nodes are recursed
  // into so structure (<br>, inline <span>s, etc.) is preserved.
  private wrapChars(): void {
    if (this.processed) return;
    this.processed = true;

    let counter = 0;
    const walk = (node: Node): void => {
      const children = Array.from(node.childNodes);
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent ?? '';
          if (!text) continue;
          const frag = document.createDocumentFragment();
          for (const ch of text) {
            const span = document.createElement('span');
            span.className = 'typewriter__char';
            span.style.setProperty('--i', String(counter++));
            span.textContent = ch;
            frag.appendChild(span);
          }
          child.parentNode?.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
        }
      }
    };
    walk(this.el.nativeElement);
  }
}
