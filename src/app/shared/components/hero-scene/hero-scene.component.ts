import { Component, AfterViewInit, OnDestroy, ElementRef, NgZone, PLATFORM_ID, ViewEncapsulation, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';

type SceneName = 'city' | 'museum' | 'beach' | 'metro' | 'desert' | 'nordic';

@Component({
  selector: 'app-hero-scene',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-scene.component.html',
  styleUrl: './hero-scene.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class HeroSceneComponent implements AfterViewInit, OnDestroy {
  private readonly host       = inject(ElementRef<HTMLElement>);
  private readonly zone       = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  // ── Town hero: a side-view scene + strolling tourists (default bg). A random
  //    scene is shown on each visit (city street or museum gallery). ───────────
  readonly townMode   = signal(true);
  readonly scene      = signal<SceneName>('city');
  readonly sceneReady = signal(false);
  readonly figures    = Array.from({ length: 12 }, (_, i) => i);
  // Each tourist gets a different body colour (drawn from across the palettes).
  readonly figureColors = [
    '#c98a8c', '#dfcb8f', '#8fb0b5', '#9c7e9e', '#b5836a', '#7d9b76',
    '#6f8fae', '#caa15e', '#a86b6b', '#5f9ea0', '#b07b9e', '#7e9e7e',
  ];

  // Where the tourists gather, per scene (fractions of the hero width). The
  // scene's viewBox maps 1:1 to the width, so these line up with the landmarks.
  // The statue and the big building are listed twice so crowds favour them.
  private readonly attractionsByScene: Record<SceneName, number[]> = {
    city:   [0.18, 0.33, 0.33, 0.47, 0.47, 0.58, 0.68, 0.82, 0.89, 0.92],
    museum: [0.16, 0.22, 0.30, 0.43, 0.50, 0.50, 0.71, 0.88, 0.88],
    beach:  [0.08, 0.30, 0.50, 0.66, 0.84, 0.84, 0.90],
    // night metropolis: pizzeria (~0.26), city hall (~0.44), burger (~0.67)
    metro:  [0.12, 0.26, 0.26, 0.44, 0.44, 0.50, 0.67, 0.67, 0.80, 0.90],
    // dawn desert: market stalls (~0.30–0.52) and the palace (~0.82) on the right
    desert: [0.10, 0.30, 0.34, 0.40, 0.46, 0.52, 0.66, 0.82, 0.82, 0.88],
    // snowy nordic town: townhouses, a statue (~0.50) and the cathedral (~0.72)
    nordic: [0.14, 0.26, 0.34, 0.46, 0.50, 0.50, 0.62, 0.72, 0.84, 0.90],
  };

  private readonly sceneList: SceneName[] = ['city', 'museum', 'beach', 'metro', 'desert', 'nordic'];
  private sceneTimer: ReturnType<typeof setInterval> | null = null;

  // Click the hero title to jump to the next scene; otherwise it rotates every 6s.
  // The tourists re-read the active scene each step, so they drift to the new
  // landmarks on their own — no restart needed.
  nextScene(): void {
    this.advanceScene();
    this.restartSceneTimer();
  }
  private advanceScene(): void {
    const i = this.sceneList.indexOf(this.scene());
    this.scene.set(this.sceneList[(i + 1) % this.sceneList.length]);
  }
  private restartSceneTimer(): void {
    if (this.sceneTimer) clearInterval(this.sceneTimer);
    this.sceneTimer = setInterval(() => this.advanceScene(), 6000);
  }

  private startFigures(): void {
    const container = this.host.nativeElement.querySelector('.hero__figures') as HTMLElement | null;
    if (!container) return;
    const w = container.clientWidth;
    const figs = Array.from(container.querySelectorAll('.figure')) as HTMLElement[];
    figs.forEach(f => {
      gsap.set(f, { x: gsap.utils.random(4, Math.max(4, w - 18)), scale: 1.3, transformOrigin: 'center bottom', opacity: 1 });
      gsap.delayedCall(gsap.utils.random(0, 1.6), () => this.stepFigure(f));
    });
  }

  /** Each figure picks a random behaviour, then schedules the next one. */
  private stepFigure(fig: HTMLElement): void {
    if (!this.townMode() || !fig.isConnected) return;
    const container = fig.parentElement as HTMLElement;
    const w     = container.clientWidth;
    const face  = fig.querySelector('.figure__face');
    const curX  = gsap.getProperty(fig, 'x') as number;
    const next  = () => this.stepFigure(fig);
    const roll  = Math.random();

    if (roll < 0.55) {
      // Walk somewhere — usually drifting toward a landmark to gather there.
      let target: number;
      if (Math.random() < 0.65) {
        const spots = this.attractionsByScene[this.scene()];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        target = gsap.utils.clamp(2, Math.max(2, w - 16), spot * w + gsap.utils.random(-26, 26));
      } else {
        target = gsap.utils.clamp(2, Math.max(2, w - 16), curX + gsap.utils.random(-150, 150));
      }
      gsap.set(face, { scaleX: target >= curX ? 1 : -1 });
      fig.classList.add('figure--walking');
      gsap.to(fig, {
        x: target,
        duration: Math.max(0.5, Math.abs(target - curX) / 26),
        ease: 'none',
        onComplete: () => { fig.classList.remove('figure--walking'); next(); },
      });
    } else if (roll < 0.76) {
      // Stop and snap a photo (camera up + flash).
      const cam = fig.querySelector('.figure__cam');
      const flash = fig.querySelector('.figure__flash');
      gsap.timeline({ onComplete: next })
        .to(cam, { opacity: 1, y: -2, duration: 0.18 })
        .fromTo(flash, { opacity: 0.9, scale: 0.2 }, { opacity: 0, scale: 2.6, duration: 0.5, ease: 'power2.out' }, '+=0.35')
        .to(cam, { opacity: 0, y: 0, duration: 0.18 }, '-=0.1');
    } else if (roll < 0.92) {
      // Pause for a little chat (speech bubble).
      const bubble = fig.querySelector('.figure__bubble');
      gsap.timeline({ onComplete: next })
        .fromTo(bubble, { opacity: 0, scale: 0.4, y: 0 }, { opacity: 1, scale: 1, y: -2, duration: 0.22, ease: 'back.out(2)' })
        .to(bubble, { duration: gsap.utils.random(0.9, 2) })
        .to(bubble, { opacity: 0, scale: 0.5, y: 0, duration: 0.2 });
    } else {
      // Idle a beat.
      gsap.delayedCall(gsap.utils.random(0.6, 1.6), next);
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Open on a sensible first scene — the city reads best on a narrow screen,
    // so mobile starts there; desktop opens on the night (metro) scene — then
    // rotate through the rest every 6s.
    const isMobile = window.matchMedia?.('(max-width: 767px)').matches ?? false;
    this.scene.set(isMobile ? 'city' : 'metro');
    this.sceneReady.set(true);
    this.restartSceneTimer();

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      // Town is the default hero background — start the tourists straight away.
      if (this.townMode()) this.startFigures();
    });
  }

  ngOnDestroy(): void {
    if (this.sceneTimer) clearInterval(this.sceneTimer);
  }
}
