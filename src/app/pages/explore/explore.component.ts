import { ChangeDetectionStrategy, Component, OnInit, ElementRef, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { gsap } from 'gsap';
import { ApiService } from '../../core/services/api.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-explore',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CardComponent, ButtonComponent, EmptyStateComponent],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit {
  private readonly api    = inject(ApiService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb     = inject(FormBuilder);
  private readonly host       = inject(ElementRef<HTMLElement>);
  private readonly zone       = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);

  readonly tours      = signal<any[]>([]);
  readonly loading    = signal(true);

  readonly filters = this.fb.nonNullable.group({
    search:   [''],
    tag:      [''],
    language: [''],
    sort:     ['newest'],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(p => {
      this.filters.patchValue({
        tag:      p.get('tag')      ?? '',
        language: p.get('language') ?? '',
        search:   p.get('search')   ?? '',
        sort:     p.get('sort')     ?? 'newest',
      }, { emitEvent: false });

      this.loadTours();
    });
  }

  loadTours(): void {
    this.loading.set(true);
    const f = this.filters.getRawValue();
    const params: Record<string, string> = {};
    if (f.search)   params['search']   = f.search;
    if (f.tag)      params['tag']      = f.tag;
    if (f.language) params['language'] = f.language;
    if (f.sort)     params['sort']     = f.sort;

    this.api.get<any[]>('/tours', params).subscribe({
      next:  t  => { this.tours.set(t); this.loading.set(false); this.animateGridIn(); },
      error: () => this.loading.set(false),
    });
  }

  // The tour cards slide up and fade in with a stagger when the grid (re)loads.
  private animateGridIn(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.zone.runOutsideAngular(() => setTimeout(() => {
      const cards = this.host.nativeElement.querySelectorAll('.explore__grid > app-card');
      if (!cards.length) return;
      gsap.from(cards, {
        y: 34, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.06,
        clearProps: 'transform,opacity',
      });
    }, 30));
  }

  search(): void { this.loadTours(); }
}
