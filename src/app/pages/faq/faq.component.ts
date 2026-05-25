import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface Faq {
  id: string;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './faq.component.html',
  styleUrl: './faq.component.scss',
})
export class FaqComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(true);
  readonly faqs    = signal<Faq[]>([]);
  readonly openId  = signal<string | null>(null);

  ngOnInit(): void {
    this.api.get<Faq[]>('/faqs').subscribe({
      next: (fs) => { this.faqs.set(fs); this.loading.set(false); },
      error: ()   => { this.loading.set(false); },
    });
  }

  toggle(id: string): void {
    this.openId.update(curr => curr === id ? null : id);
  }
}
