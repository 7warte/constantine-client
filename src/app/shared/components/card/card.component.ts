import { Component, Input, NgZone, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { StarRatingComponent } from '../star-rating/star-rating.component';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule, RouterLink, StarRatingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent {
  @Input({ required: true }) tour!: any;

  // The signed-in user already owns this tour: the card reads as "in your
  // library" instead of showing a price. It stays clickable either way.
  @Input() owned = false;

  private readonly zone = inject(NgZone);

  // Sober GSAP hover: a gentle lift + soft shadow.
  onEnter(e: Event): void {
    const el = e.currentTarget as HTMLElement;
    this.zone.runOutsideAngular(() =>
      gsap.to(el, { y: -8, scale: 1.022, boxShadow: '0 16px 34px rgba(0,0,0,0.13)', duration: 0.4, ease: 'power3.out' }));
  }
  onLeave(e: Event): void {
    const el = e.currentTarget as HTMLElement;
    this.zone.runOutsideAngular(() =>
      gsap.to(el, { y: 0, scale: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', duration: 0.35, ease: 'power2.out' }));
  }
}
