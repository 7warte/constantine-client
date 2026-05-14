import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AdminApiService } from '../../admin-api.service';

interface LegalDoc {
  slug: string;
  title: string;
  body_md: string;
  version: number;
  updated_at: string;
}

@Component({
  selector: 'app-admin-legal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-legal.component.html',
  styleUrl: './admin-legal.component.scss',
})
export class AdminLegalComponent implements OnInit, OnDestroy {
  private readonly api   = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyed$ = new Subject<void>();

  readonly slug    = signal<string>('');
  readonly loading = signal(true);
  readonly saving  = signal(false);
  readonly error   = signal<string | null>(null);
  readonly title   = signal('');
  readonly bodyMd  = signal('');
  readonly version = signal<number | null>(null);
  readonly updatedAt = signal<string | null>(null);

  /** Track unsaved changes so we can light up the Save button. */
  private original = { title: '', body: '' };
  readonly dirty = computed(() =>
    this.title() !== this.original.title || this.bodyMd() !== this.original.body
  );

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroyed$)).subscribe(p => {
      const slug = p.get('slug') ?? 'terms';
      this.slug.set(slug);
      this.load(slug);
    });
  }

  ngOnDestroy(): void { this.destroyed$.next(); this.destroyed$.complete(); }

  load(slug: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<LegalDoc>(`/legal/${slug}`).subscribe({
      next: (d) => {
        this.title.set(d.title);
        this.bodyMd.set(d.body_md);
        this.version.set(d.version);
        this.updatedAt.set(d.updated_at);
        this.original = { title: d.title, body: d.body_md };
        this.loading.set(false);
      },
      error: (e: any) => {
        this.error.set(e.error?.error ?? 'Failed to load');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.put<LegalDoc>(`/legal/${this.slug()}`, {
      title: this.title(),
      body_md: this.bodyMd(),
    }).subscribe({
      next: (d) => {
        this.saving.set(false);
        this.version.set(d.version);
        this.updatedAt.set(d.updated_at);
        this.original = { title: d.title, body: d.body_md };
      },
      error: (e: any) => {
        this.saving.set(false);
        this.error.set(e.error?.error ?? 'Save failed');
      },
    });
  }

  pageTitle(): string {
    const s = this.slug();
    if (s === 'terms')   return 'Terms & Conditions';
    if (s === 'privacy') return 'Privacy Policy';
    return s.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  }
}
