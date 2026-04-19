import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { ButtonComponent } from '../../shared/components/button/button.component';

@Component({
  selector: 'app-explore',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CardComponent, ButtonComponent],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss',
})
export class ExploreComponent implements OnInit {
  private readonly api    = inject(ApiService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb     = inject(FormBuilder);

  readonly tours      = signal<any[]>([]);
  readonly loading    = signal(true);

  readonly filters = this.fb.nonNullable.group({
    search:   [''],
    tag:      [''],
    language: [''],
    sort:     ['newest'],
  });

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.filters.patchValue({
      tag:      p['tag']      ?? '',
      language: p['language'] ?? '',
      search:   p['search']   ?? '',
      sort:     p['sort']     ?? 'newest',
    });

    this.loadTours();
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
      next:  t  => { this.tours.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  search(): void { this.loadTours(); }
}
