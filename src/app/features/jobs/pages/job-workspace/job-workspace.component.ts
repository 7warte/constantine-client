import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AudioRecorderComponent } from '../../../../shared/components/audio-recorder/audio-recorder.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-job-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CommonModule, AudioRecorderComponent],
  templateUrl: './job-workspace.component.html',
  styleUrl: './job-workspace.component.scss',
})
export class JobWorkspaceComponent implements OnInit {
  private readonly api   = inject(ApiService);
  private readonly auth  = inject(AuthService);
  private readonly http  = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly fb    = inject(FormBuilder);

  readonly loading        = signal(true);
  readonly saving         = signal(false);
  readonly job            = signal<any | null>(null);
  readonly originalStops  = signal<any[]>([]);
  readonly translatedStops = signal<any[]>([]);
  readonly activeIdx      = signal(0);
  readonly variantId      = signal<string | null>(null);

  readonly jobId = this.route.snapshot.paramMap.get('jobId') ?? '';

  readonly activeStop = computed(() => this.originalStops()[this.activeIdx()] ?? null);

  readonly translationForm = this.fb.nonNullable.group({
    title:       ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.api.get<any>(`/jobs/${this.jobId}`).subscribe({
      next: (job) => {
        this.job.set(job);

        // Load original variant's stops
        this.api.get<any[]>(`/studio/tours/${job.tour_id}/variants`).subscribe(variants => {
          const original = variants.find((v: any) => v.is_original);
          if (original) {
            this.api.get<any[]>(`/studio/tours/${job.tour_id}/variants/${original.id}/stops`).subscribe(
              stops => {
                this.originalStops.set(stops);
                this.loading.set(false);
                if (stops.length > 0) this.selectStop(0);
              }
            );
          } else {
            this.loading.set(false);
          }

          // Find or note the translated variant for this language
          const translated = variants.find((v: any) =>
            v.language_code === job.target_language_code && !v.is_original
          );
          if (translated) {
            this.variantId.set(translated.id);
            this.loadTranslatedStops(job.tour_id, translated.id);
          }
        });
      },
      error: () => this.loading.set(false),
    });
  }

  selectStop(idx: number): void {
    this.activeIdx.set(idx);
    const stop = this.originalStops()[idx];
    if (!stop) return;

    // Pre-fill form with existing translation if any
    const translated = this.getTranslatedStop(stop.order_index);
    this.translationForm.patchValue({
      title: translated?.title ?? '',
      description: translated?.description ?? '',
    });
  }

  getTranslatedStop(orderIndex: number): any | null {
    return this.translatedStops().find(s => s.order_index === orderIndex) ?? null;
  }

  saveTranslation(): void {
    const stop = this.activeStop();
    const job = this.job();
    if (!stop || !job || this.translationForm.invalid) return;

    this.saving.set(true);
    const body = this.translationForm.getRawValue();
    const vid = this.variantId();
    const existing = this.getTranslatedStop(stop.order_index);

    if (vid && existing) {
      this.api.patch<any>(
        `/studio/tours/${job.tour_id}/variants/${vid}/stops/${existing.id}`,
        body
      ).subscribe({
        next: () => { this.saving.set(false); this.loadTranslatedStops(job.tour_id, vid); },
        error: () => this.saving.set(false),
      });
    } else if (vid) {
      this.api.post<any>(
        `/studio/tours/${job.tour_id}/variants/${vid}/stops`,
        body
      ).subscribe({
        next: () => { this.saving.set(false); this.loadTranslatedStops(job.tour_id, vid); },
        error: () => this.saving.set(false),
      });
    }
  }

  onRecordedAudio(file: File): void {
    const vid = this.variantId();
    const stop = this.activeStop();
    if (!vid || !stop) return;

    const translated = this.getTranslatedStop(stop.order_index);
    if (!translated) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', 'audio');

    this.http.post<any>(
      `${environment.apiUrl}/studio/stops/${translated.id}/media/upload`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: () => this.loadTranslatedStops(this.job()!.tour_id, vid),
    });
  }

  private loadTranslatedStops(tourId: string, variantId: string): void {
    this.api.get<any[]>(`/studio/tours/${tourId}/variants/${variantId}/stops`).subscribe(
      stops => this.translatedStops.set(stops)
    );
  }
}
