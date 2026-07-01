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
import { HeroSceneComponent } from '../../shared/components/hero-scene/hero-scene.component';

interface Faq {
  id: string;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, ReactiveFormsModule, ButtonComponent, CardComponent, RevealOnViewDirective, TypewriterOnViewDirective, HeroSceneComponent],
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

  // Hero background videos — admin-managed playlists, fall back to the bundled clip.
  private readonly BUNDLED_HERO = 'assets/hero-videos/7062383-hd_1920_1080_24fps.mp4';
  readonly heroDesktop = signal<string[]>([]);
  readonly heroMobile  = signal<string[]>([]);
  readonly isMobile    = signal(false);

  // Active playlist: mobile clips on mobile (falling back to desktop clips),
  // desktop clips otherwise; the bundled clip when nothing is configured.
  readonly playlist = computed<string[]>(() => {
    const list = this.isMobile()
      ? (this.heroMobile().length ? this.heroMobile() : this.heroDesktop())
      : this.heroDesktop();
    return list.length ? list : [this.BUNDLED_HERO];
  });

  readonly currentIndex = signal(0);
  readonly currentSrc = computed(() => {
    const list = this.playlist();
    return list[this.currentIndex() % list.length];
  });

  private heroMql: MediaQueryList | null = null;
  private readonly onHeroMqlChange = (e: MediaQueryListEvent) => {
    this.isMobile.set(e.matches);
    this.currentIndex.set(0);   // playlist may change with viewport — restart it
  };

  onVideoEnded(): void {
    const len = this.playlist().length;
    if (len <= 1) return;   // single clip loops natively via [loop]
    this.currentIndex.update(i => (i + 1) % len);
  }
  readonly activeSlide     = signal(0);
  readonly indoorTours     = signal<any[]>([]);
  readonly outdoorTours    = signal<any[]>([]);
  readonly topRatedTours   = signal<any[]>([]);
  readonly destinationCtrl = new FormControl('', { nonNullable: true });

  // Each image declares its text color so the hero title/sub stay readable.
  // Use 'dark' for light/bright photos, 'light' for dim/dark photos.
  readonly heroImages: { src: string; textColor: 'dark' | 'light' }[] = [
    { src: 'assets/homepage/hero-images/chris-czermak.jpg',                       textColor: 'dark'  },
    { src: 'assets/homepage/hero-images/andrei-mike-LLRENtzIo34-unsplash.jpg',    textColor: 'light' },
    { src: 'assets/homepage/hero-images/jean-baptiste-d-OGw8hPRgPpY-unsplash.jpg', textColor: 'light' },
    { src: 'assets/homepage/hero-images/kai-pilger-1_D59lYGpZA-unsplash.jpg',     textColor: 'light' },
    { src: 'assets/homepage/hero-images/olivia-pedler-YX0HXl2SwIo-unsplash.jpg',  textColor: 'light' },
    { src: 'assets/homepage/hero-images/priscilla-du-preez-7etIYqqw2jU-unsplash.jpg', textColor: 'light' },
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
    if (isPlatformBrowser(this.platformId)) {
      // Track viewport so the hero can pick the portrait vs landscape clip.
      this.heroMql = window.matchMedia('(max-width: 767px)');
      this.isMobile.set(this.heroMql.matches);
      this.heroMql.addEventListener('change', this.onHeroMqlChange);

      this.api.get<{ desktop: string[]; mobile: string[] }>('/hero-videos')
        .subscribe(v => {
          this.heroDesktop.set(v.desktop ?? []);
          this.heroMobile.set(v.mobile ?? []);
          this.currentIndex.set(0);
        });

      // Rotate the mobile hero images as a slow crossfade slideshow.
      this.slideTimer = setInterval(
        () => this.activeSlide.update(i => (i + 1) % this.heroImages.length),
        5000,
      );
    }

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

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

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
    });
  }

  ngOnDestroy(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
    this.gsapCtx?.revert();
    this.heroMql?.removeEventListener('change', this.onHeroMqlChange);
  }

  toggleFaq(id: string): void {
    this.openFaq.update(curr => (curr === id ? null : id));
  }

  onSearchDestination(event?: Event): void {
    // The form has no NgForm directive (reactive-only module), so the native
    // submit must be prevented manually — otherwise the page reloads instead
    // of routing to /explore.
    event?.preventDefault();
    const q = this.destinationCtrl.value.trim();
    this.router.navigate(['/explore'], q ? { queryParams: { search: q } } : undefined);
  }
}
