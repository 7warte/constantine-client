import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../admin-api.service';

interface Todo {
  id: string;
  body: string;
  done: boolean;
  priority: 0 | 1;
  created_at: string;
  done_at: string | null;
}

@Component({
  selector: 'app-admin-todos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-todos.component.html',
  styleUrl: './admin-todos.component.scss',
})
export class AdminTodosComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly loading  = signal(true);
  readonly error    = signal<string | null>(null);
  readonly todos    = signal<Todo[]>([]);
  readonly newBody  = signal('');
  readonly newHigh  = signal(false);
  readonly adding   = signal(false);

  readonly open    = computed(() => this.todos().filter(t => !t.done));
  readonly closed  = computed(() => this.todos().filter(t =>  t.done));

  ngOnInit(): void { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<Todo[]>('/todos').subscribe({
      next: (ts) => { this.todos.set(ts); this.loading.set(false); },
      error: (e) => { this.error.set(e.error?.error ?? 'Failed to load'); this.loading.set(false); },
    });
  }

  add(): void {
    const body = this.newBody().trim();
    if (!body || this.adding()) return;
    this.adding.set(true);
    this.api.post<Todo>('/todos', { body, priority: this.newHigh() ? 1 : 0 }).subscribe({
      next: (t) => {
        this.adding.set(false);
        this.todos.update(ts => [t, ...ts]);
        this.newBody.set('');
        this.newHigh.set(false);
      },
      error: (e) => {
        this.adding.set(false);
        this.error.set(e.error?.error ?? 'Failed to add');
      },
    });
  }

  toggleDone(t: Todo): void {
    this.api.patch<Todo>(`/todos/${t.id}`, { done: !t.done }).subscribe({
      next: (updated) => this.todos.update(ts => ts.map(x => x.id === t.id ? updated : x)),
    });
  }

  togglePriority(t: Todo): void {
    const next = t.priority === 1 ? 0 : 1;
    this.api.patch<Todo>(`/todos/${t.id}`, { priority: next }).subscribe({
      next: (updated) => this.todos.update(ts => ts.map(x => x.id === t.id ? updated : x)),
    });
  }

  remove(t: Todo): void {
    this.api.delete(`/todos/${t.id}`).subscribe({
      next: () => this.todos.update(ts => ts.filter(x => x.id !== t.id)),
    });
  }
}
