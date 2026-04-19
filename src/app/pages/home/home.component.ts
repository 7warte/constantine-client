import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardComponent } from '../../shared/components/card/card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CommonModule, ButtonComponent, CardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  readonly featuredTours = signal<any[]>([]);
  readonly categories    = signal<any[]>([]);
  readonly activeSlide   = signal(0);

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

  readonly heroImages = [
    'assets/homepage/andrei-mike-LLRENtzIo34-unsplash.jpg',
    'assets/homepage/jean-baptiste-d-OGw8hPRgPpY-unsplash.jpg',
    'assets/homepage/kai-pilger-1_D59lYGpZA-unsplash.jpg',
    'assets/homepage/olivia-pedler-YX0HXl2SwIo-unsplash.jpg',
    'assets/homepage/priscilla-du-preez-7etIYqqw2jU-unsplash.jpg',
  ];

  private slideTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.api.get<any[]>('/tours', { limit: 6, sort: 'top_rated' })
      .subscribe(tours => this.featuredTours.set(tours));

    this.api.get<any[]>('/categories')
      .subscribe(cats => this.categories.set(cats));

    this.slideTimer = setInterval(() => {
      this.activeSlide.update(i => (i + 1) % this.heroImages.length);
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.slideTimer) clearInterval(this.slideTimer);
  }
}
