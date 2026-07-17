import { Component, inject, signal, ChangeDetectionStrategy, ElementRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { gsap } from 'gsap';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { APP_RELEASED } from '../../../core/app-release';
import { AuthService } from '../../../core/services/auth.service';
import { OfflineService } from '../../../core/offline/offline.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, MatIconModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly auth     = inject(AuthService);
  readonly offline  = inject(OfflineService);
  /** Gates the Downloads link — hidden until the app is on the App Store. */
  readonly appReleased = APP_RELEASED;
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  readonly menuOpen = signal(false);
  private closing = false;

  constructor() {
    // Always close the menu once a navigation actually completes, so its open
    // state can never get stuck out of sync with the route. (Snap, no animation —
    // the page is changing anyway.)
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => { this.closing = false; this.menuOpen.set(false); });
  }

  toggleMenu(): void {
    if (this.menuOpen()) { this.closeMenu(); return; }
    this.menuOpen.set(true);
    // Wait for the overlay to render, then slide the panel down as items pop in.
    this.zone.runOutsideAngular(() => setTimeout(() => this.animateOpen(), 20));
  }

  /** Slide the panel up while the items disappear, then remove the overlay. */
  closeMenu(): void {
    if (!this.menuOpen() || this.closing) return;
    const panel = this.overlayEl();
    if (!panel) { this.menuOpen.set(false); return; }
    const items = this.host.nativeElement.querySelectorAll('.navbar__mobile-link');
    this.closing = true;
    this.zone.runOutsideAngular(() => {
      const tl = gsap.timeline({
        onComplete: () => this.zone.run(() => { this.closing = false; this.menuOpen.set(false); }),
      });
      if (items.length) {
        tl.to(items, {
          y: 14, opacity: 0, duration: 0.2,
          stagger: { each: 0.04, from: 'end' },   // last item leaves first
          ease: 'power2.in',
        }, 0);
      }
      // Panel slides up as the items are leaving. `y` (px) matches the CSS
      // translateY(-100%) start state — gsap reads that as pixels, not percent.
      tl.to(panel, { y: -panel.offsetHeight, duration: 0.32, ease: 'power3.in' }, '<0.05');
    });
  }

  private overlayEl(): HTMLElement | null {
    return this.host.nativeElement.querySelector('.navbar__mobile');
  }

  /** Slide the panel down into place while the items pop in one after another. */
  private animateOpen(): void {
    const panel = this.overlayEl();
    if (!panel) return;
    const items = this.host.nativeElement.querySelectorAll('.navbar__mobile-link');
    const tl = gsap.timeline();
    // The panel starts at CSS translateY(-100%) (read as -height px); slide to 0.
    tl.to(panel, { y: 0, duration: 0.4, ease: 'power3.out' }, 0);
    if (items.length) {
      tl.from(items, {
        y: 14, opacity: 0, duration: 0.32, stagger: 0.05,
        ease: 'back.out(1.6)', clearProps: 'transform,opacity',
      }, 0.06);
    }
  }
}
