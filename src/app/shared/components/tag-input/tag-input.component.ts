import {
  Component, ChangeDetectionStrategy, Input, Output, EventEmitter,
  inject, signal, OnInit, OnDestroy, ElementRef, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, Subscription } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-tag-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './tag-input.component.html',
  styleUrl: './tag-input.component.scss',
})
export class TagInputComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);

  @Input() tags: string[] = [];
  @Output() tagsChange = new EventEmitter<string[]>();
  @ViewChild('input') inputRef!: ElementRef<HTMLInputElement>;

  readonly suggestions = signal<string[]>([]);
  readonly showSuggestions = signal(false);
  readonly inputValue = signal('');

  private search$ = new Subject<string>();
  private sub!: Subscription;

  ngOnInit(): void {
    this.sub = this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => q.length >= 1
        ? this.api.get<{ id: string; name: string }[]>('/tags', { q, limit: 8 })
        : of([])
      ),
    ).subscribe(results => {
      const existing = new Set(this.tags.map(t => t.toLowerCase()));
      this.suggestions.set(
        results.map(r => r.name).filter(n => !existing.has(n.toLowerCase()))
      );
      this.showSuggestions.set(this.suggestions().length > 0);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.inputValue.set(value);
    this.search$.next(value.trim());
  }

  onKeydown(event: KeyboardEvent): void {
    const value = this.inputValue().trim();

    if ((event.key === 'Enter' || event.key === ',' || event.key === ' ') && value) {
      event.preventDefault();
      // Split by commas and spaces to handle pasted multi-tag strings
      const parts = value.split(/[,\s]+/).filter(Boolean);
      for (const part of parts) {
        this.addTag(part);
      }
      this.inputRef.nativeElement.value = '';
      this.inputValue.set('');
      return;
    }

    if (event.key === 'Backspace' && !value && this.tags.length > 0) {
      this.removeTag(this.tags.length - 1);
    }
  }

  selectSuggestion(name: string): void {
    this.addTag(name);
    this.inputRef.nativeElement.focus();
  }

  addTag(name: string): void {
    const normalised = name.trim().toLowerCase();
    if (!normalised || this.tags.some(t => t.toLowerCase() === normalised)) return;

    this.tags = [...this.tags, normalised];
    this.tagsChange.emit(this.tags);
    this.inputValue.set('');
    this.inputRef.nativeElement.value = '';
    this.showSuggestions.set(false);
  }

  removeTag(index: number): void {
    this.tags = this.tags.filter((_, i) => i !== index);
    this.tagsChange.emit(this.tags);
  }

  onBlur(): void {
    // Delay to allow click on suggestion
    setTimeout(() => this.showSuggestions.set(false), 200);
  }
}
