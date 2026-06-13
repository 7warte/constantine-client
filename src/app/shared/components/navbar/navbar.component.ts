import { Component, inject, signal, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import { AuthService } from '../../../core/services/auth.service';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly auth     = inject(AuthService);
  private readonly zone = inject(NgZone);
  readonly menuOpen = signal(false);

  toggleMenu(): void { this.menuOpen.update(v => !v); }
  closeMenu():  void { this.menuOpen.set(false); }

  // Cool GSAP hover: a wheat panel wipes in from the left, the label darkens and
  // nudges right, and an arrow flies in from the right. Run outside Angular.
  onLinkEnter(e: Event): void {
    const el = e.currentTarget as HTMLElement;
    const fill  = el.querySelector('.navbar__mobile-fill');
    const text  = el.querySelector('.navbar__mobile-text');
    const arrow = el.querySelector('.navbar__mobile-arrow');
    this.zone.runOutsideAngular(() => {
      gsap.to(fill,  { scaleX: 1, transformOrigin: 'left center', duration: 0.45, ease: 'power3.out' });
      gsap.to(text,  { x: 10, color: '#1a1a1a', duration: 0.4, ease: 'power2.out' });
      gsap.to(arrow, { x: 0, opacity: 1, color: '#1a1a1a', duration: 0.45, ease: 'back.out(3)' });
    });
  }

  onLinkLeave(e: Event): void {
    const el = e.currentTarget as HTMLElement;
    const fill  = el.querySelector('.navbar__mobile-fill');
    const text  = el.querySelector('.navbar__mobile-text');
    const arrow = el.querySelector('.navbar__mobile-arrow');
    this.zone.runOutsideAngular(() => {
      gsap.to(fill,  { scaleX: 0, transformOrigin: 'left center', duration: 0.3, ease: 'power2.in' });
      gsap.to(text,  { x: 0, color: 'rgba(255,255,255,0.7)', duration: 0.35, ease: 'power3.out' });
      gsap.to(arrow, { x: -12, opacity: 0, duration: 0.3, ease: 'power2.in' });
    });
  }
}
