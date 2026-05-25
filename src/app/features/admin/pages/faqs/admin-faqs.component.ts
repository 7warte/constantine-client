import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../admin-api.service';

interface Faq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
  show_on_home: boolean;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-admin-faqs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-faqs.component.html',
  styleUrl: './admin-faqs.component.scss',
})
export class AdminFaqsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading  = signal(true);
  readonly error    = signal<string | null>(null);
  readonly faqs     = signal<Faq[]>([]);

  readonly newQuestion = signal('');
  readonly newAnswer   = signal('');
  readonly adding      = signal(false);

  readonly editingId = signal<string | null>(null);

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<Faq[]>('/faqs').subscribe({
      next: (fs) => { this.faqs.set(fs); this.loading.set(false); },
      error: (e)  => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  add(): void {
    const question = this.newQuestion().trim();
    const answer   = this.newAnswer().trim();
    if (!question || !answer || this.adding()) return;
    this.adding.set(true);
    this.api.post<Faq>('/faqs', { question, answer }).subscribe({
      next: (f) => {
        this.adding.set(false);
        this.faqs.update(xs => [...xs, f].sort((a, b) => a.sort_order - b.sort_order));
        this.newQuestion.set('');
        this.newAnswer.set('');
      },
      error: (e) => {
        this.adding.set(false);
        this.error.set(e.error?.error ?? 'Failed to add');
      },
    });
  }

  startEdit(f: Faq): void {
    this.editingId.set(f.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.reload();
  }

  saveEdit(f: Faq, question: string, answer: string): void {
    const q = question.trim();
    const a = answer.trim();
    if (!q || !a) return;
    this.api.patch<Faq>(`/faqs/${f.id}`, { question: q, answer: a }).subscribe({
      next: (updated) => {
        this.faqs.update(xs => xs.map(x => x.id === f.id ? updated : x));
        this.editingId.set(null);
      },
      error: (e) => this.error.set(e.error?.error ?? 'Failed to save'),
    });
  }

  togglePublished(f: Faq): void {
    this.api.patch<Faq>(`/faqs/${f.id}`, { is_published: !f.is_published }).subscribe({
      next: (updated) => this.faqs.update(xs => xs.map(x => x.id === f.id ? updated : x)),
    });
  }

  toggleHome(f: Faq): void {
    this.api.patch<Faq>(`/faqs/${f.id}`, { show_on_home: !f.show_on_home }).subscribe({
      next: (updated) => this.faqs.update(xs => xs.map(x => x.id === f.id ? updated : x)),
    });
  }

  move(f: Faq, direction: -1 | 1): void {
    const list = [...this.faqs()].sort((a, b) => a.sort_order - b.sort_order);
    const idx  = list.findIndex(x => x.id === f.id);
    const swap = list[idx + direction];
    if (!swap) return;

    // Swap the two sort_orders
    const a = swap.sort_order;
    const b = f.sort_order;
    this.api.patch<Faq>(`/faqs/${f.id}`,   { sort_order: a }).subscribe();
    this.api.patch<Faq>(`/faqs/${swap.id}`, { sort_order: b }).subscribe({
      next: () => this.reload(),
    });
  }

  remove(f: Faq): void {
    if (!confirm('Delete this FAQ? This cannot be undone.')) return;
    this.api.delete(`/faqs/${f.id}`).subscribe({
      next: () => this.faqs.update(xs => xs.filter(x => x.id !== f.id)),
    });
  }
}
