import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, NgZone, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ApiService } from '../../core/services/api.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { RevealOnViewDirective } from '../../shared/directives/reveal-on-view.directive';
import { TypewriterOnViewDirective } from '../../shared/directives/typewriter-on-view.directive';

type SceneName = 'city' | 'museum' | 'beach' | 'metro' | 'desert' | 'nordic';

interface Faq {
  id: string;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, ReactiveFormsModule, ButtonComponent, CardComponent, RevealOnViewDirective, TypewriterOnViewDirective],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly api    = inject(ApiService);
  private readonly router = inject(Router);
  private readonly host       = inject(ElementRef<HTMLElement>);
  private readonly zone       = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private gsapCtx: gsap.Context | undefined;

  readonly faqItems        = signal<Faq[]>([]);
  readonly openFaq         = signal<string | null>(null);
  readonly activeSlide     = signal(0);
  readonly indoorTours     = signal<any[]>([]);
  readonly outdoorTours    = signal<any[]>([]);
  readonly topRatedTours   = signal<any[]>([]);
  readonly destinationCtrl = new FormControl('', { nonNullable: true });

  // Each image declares its text color so the hero title/sub stay readable.
  // Use 'dark' for light/bright photos, 'light' for dim/dark photos.
  readonly heroImages: { src: string; textColor: 'dark' | 'light' }[] = [
    { src: 'assets/homepage/chris-czermak.jpg',                       textColor: 'dark'  },
    { src: 'assets/homepage/andrei-mike-LLRENtzIo34-unsplash.jpg',    textColor: 'light' },
    { src: 'assets/homepage/jean-baptiste-d-OGw8hPRgPpY-unsplash.jpg', textColor: 'light' },
    { src: 'assets/homepage/kai-pilger-1_D59lYGpZA-unsplash.jpg',     textColor: 'light' },
    { src: 'assets/homepage/olivia-pedler-YX0HXl2SwIo-unsplash.jpg',  textColor: 'light' },
    { src: 'assets/homepage/priscilla-du-preez-7etIYqqw2jU-unsplash.jpg', textColor: 'light' },
  ];

  readonly activeTextColor = computed(() => this.heroImages[this.activeSlide()].textColor);

  private slideTimer: ReturnType<typeof setInterval> | null = null;

  readonly quotes = [
    { text: 'The world is a book and those who do not travel read only one page.', author: 'Saint Augustine' },
    { text: 'Travel is fatal to prejudice, bigotry, and narrow-mindedness.', author: 'Mark Twain' },
    { text: 'A museum is a place where one should lose one\'s head.', author: 'Renzo Piano' },
    { text: 'Not all those who wander are lost.', author: 'J.R.R. Tolkien' },
    { text: 'The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.', author: 'Marcel Proust' },
    { text: 'To travel is to discover that everyone is wrong about other countries.', author: 'Aldous Huxley' },
    { text: 'A people without the knowledge of their past history, origin, and culture is like a tree without roots.', author: 'Marcus Garvey' },
    { text: 'Travel makes one modest. You see what a tiny place you occupy in the world.', author: 'Gustave Flaubert' },
    { text: 'Museums are the memory of mankind.', author: 'Karel Appel' },
    { text: 'The purpose of life is to live it, to taste experience to the utmost.', author: 'Eleanor Roosevelt' },
    { text: 'Culture is the widening of the mind and of the spirit.', author: 'Jawaharlal Nehru' },
    { text: 'One\'s destination is never a place, but a new way of seeing things.', author: 'Henry Miller' },
    { text: 'Every artist was first an amateur.', author: 'Ralph Waldo Emerson' },
    { text: 'Art enables us to find ourselves and lose ourselves at the same time.', author: 'Thomas Merton' },
    { text: 'The use of traveling is to regulate imagination with reality.', author: 'Samuel Johnson' },
    { text: 'He who would learn to fly one day must first learn to walk and run and climb and dance.', author: 'Friedrich Nietzsche' },
    { text: 'A great city is not to be confounded with a populous one.', author: 'Aristotle' },
    { text: 'To teach is to learn twice.', author: 'Joseph Joubert' },
    { text: 'Without culture, and the relative freedom it implies, society, even when perfect, is but a jungle.', author: 'Albert Camus' },
    { text: 'Traveling — it leaves you speechless, then turns you into a storyteller.', author: 'Ibn Battuta' },
    { text: 'The mind that opens to a new idea never returns to its original size.', author: 'Albert Einstein' },
    { text: 'In every walk with nature, one receives far more than he seeks.', author: 'John Muir' },
    { text: 'Education is not the filling of a pail, but the lighting of a fire.', author: 'W.B. Yeats' },
    { text: 'Architecture should speak of its time and place, but yearn for timelessness.', author: 'Frank Gehry' },
    { text: 'Life is either a daring adventure or nothing at all.', author: 'Helen Keller' },
    { text: 'A walk about Paris will provide lessons in history, beauty, and in the point of life.', author: 'Thomas Jefferson' },
    { text: 'The world is full of magic things, patiently waiting for our senses to grow sharper.', author: 'W.B. Yeats' },
    { text: 'We do not inherit the earth from our ancestors, we borrow it from our children.', author: 'Native American Proverb' },
    { text: 'Knowledge speaks, but wisdom listens.', author: 'Jimi Hendrix' },
    { text: 'To move, to breathe, to fly, to float, to roam the roads of lands remote.', author: 'Walt Whitman' },
  ];

  readonly activeQuote = this.quotes[Math.floor(Math.random() * this.quotes.length)];

  ngOnInit(): void {
    this.api.get<Faq[]>('/faqs', { home: 1 })
      .subscribe(items => {
        this.faqItems.set(items);
        if (items.length > 0) this.openFaq.set(items[0].id);
      });

    this.api.get<any[]>('/tours', { sort: 'top_rated', limit: '2' })
      .subscribe(tours => this.topRatedTours.set(tours.slice(0, 2)));

    this.api.get<any[]>('/tours', { tag: 'indoor', limit: '2' })
      .subscribe(tours => this.indoorTours.set(tours.slice(0, 2)));

    this.api.get<any[]>('/tours', { tag: 'outdoor', limit: '2' })
      .subscribe(tours => this.outdoorTours.set(tours.slice(0, 2)));
  }

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

    // Show a random scene this visit (rendered browser-side to avoid SSR mismatch),
    // then rotate scenes every 6 seconds.
    this.scene.set(this.sceneList[Math.floor(Math.random() * this.sceneList.length)]);
    this.sceneReady.set(true);
    this.restartSceneTimer();

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      gsap.registerPlugin(ScrollTrigger);
      const root = this.host.nativeElement;

      this.gsapCtx = gsap.context(() => {
        // Hero — title, subtitle and actions rise in on load.
        gsap.from(['.hero__title', '.hero__sub', '.hero__actions'], {
          y: 38, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.16, delay: 0.1,
        });

        // "Learn and explore at your own pace" — split into words that bounce
        // up one-by-one as the section scrolls into view.
        const title = root.querySelector('.features__title') as HTMLElement | null;
        if (title?.textContent) {
          const words = title.textContent.trim().split(/\s+/);
          title.innerHTML = words.map(w => `<span class="g-word">${w}</span>`).join(' ');
          gsap.from(title.querySelectorAll('.g-word'), {
            yPercent: 60, opacity: 0, rotationZ: 6, transformOrigin: '0% 100%',
            duration: 0.7, ease: 'back.out(1.7)', stagger: 0.06,
            scrollTrigger: { trigger: title, start: 'top 85%', once: true },
          });
        }

        // Feature cards slide up in a stagger.
        gsap.from('.feature', {
          y: 50, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.14,
          scrollTrigger: { trigger: '.features__grid', start: 'top 80%', once: true },
        });

        // "How it works" steps slide in from the left.
        gsap.from('.numbered-list li', {
          x: -32, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.13,
          scrollTrigger: { trigger: '.numbered-list', start: 'top 82%', once: true },
        });
      }, root);

      // Async tour cards above can shift layout — recompute trigger positions.
      setTimeout(() => ScrollTrigger.refresh(), 1000);

      // Town is the default hero background — start the tourists straight away.
      if (this.townMode()) this.startFigures();
    });
  }

  ngOnDestroy(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
    if (this.sceneTimer) clearInterval(this.sceneTimer);
    this.gsapCtx?.revert();
  }

  toggleFaq(id: string): void {
    this.openFaq.update(curr => (curr === id ? null : id));
  }

  onSearchDestination(): void {
    const q = this.destinationCtrl.value.trim();
    this.router.navigate(['/explore'], q ? { queryParams: { search: q } } : undefined);
  }
}
