import { Component, inject, signal, ChangeDetectionStrategy, ElementRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { gsap } from 'gsap';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
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
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  readonly menuOpen = signal(false);

  constructor() {
    // Always close the menu once a navigation actually completes, so its open
    // state can never get stuck out of sync with the route.
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.menuOpen.set(false));
  }

  toggleMenu(): void {
    const willOpen = !this.menuOpen();
    this.menuOpen.set(willOpen);
    if (willOpen) this.animateMenuItems();
  }

  closeMenu(): void { this.menuOpen.set(false); }

  /** Pop the menu items in one after another when the overlay opens. */
  private animateMenuItems(): void {
    this.zone.runOutsideAngular(() => setTimeout(() => {
      const items = this.host.nativeElement.querySelectorAll('.navbar__mobile-link');
      if (!items.length) return;
      gsap.from(items, {
        y: 14,
        opacity: 0,
        duration: 0.32,
        stagger: 0.05,
        ease: 'back.out(1.6)',
        clearProps: 'transform,opacity',
      });
    }, 20));
  }
}
