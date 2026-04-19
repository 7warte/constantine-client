import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AudioRecorderComponent } from '../../../../shared/components/audio-recorder/audio-recorder.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-variant-edit',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, CommonModule, AudioRecorderComponent],
  templateUrl: './variant-edit.component.html',
  styleUrl: './variant-edit.component.scss',
})
export class VariantEditComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly api    = inject(ApiService);
  private readonly auth   = inject(AuthService);
  private readonly http   = inject(HttpClient);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading       = signal(false);
  readonly saving        = signal(false);
  readonly publishing    = signal(false);
  readonly error         = signal<string | null>(null);
  readonly variant       = signal<any | null>(null);
  readonly originalStops = signal<any[]>([]);
  readonly translatedStops = signal<any[]>([]);
  readonly originalVariantId = signal<string | null>(null);
  readonly originalLang      = signal('');
  readonly tourData           = signal<any | null>(null);

  readonly tourId    = signal('');
  readonly variantId = signal('');
  readonly isNew     = computed(() => this.variantId() === 'new');
  readonly isOriginal = computed(() => this.variant()?.is_original === true);

  readonly form = this.fb.nonNullable.group({
    language_code: ['', Validators.required],
    title:         ['', Validators.required],
  });

  // ── Translation request state ─────────────────────────────────
  readonly requestForm = this.fb.nonNullable.group({
    target_language_code: ['', Validators.required],
    description:          [''],
    compensation_type:    ['percentage' as 'fixed' | 'percentage', Validators.required],
    compensation_value:   [0, [Validators.required, Validators.min(0)]],
    visibility:           ['public' as 'public' | 'direct'],
    invite_email:         [''],
  });
  readonly postingRequest   = signal(false);
  readonly requestError     = signal<string | null>(null);
  readonly requestSuccess   = signal(false);

  readonly savingMeta = signal(false);
  readonly metaSaved  = signal(false);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.tourId.set(params.get('tourId') ?? '');
      this.variantId.set(params.get('variantId') ?? '');
      this.initData();
    });
  }

  private initData(): void {
    // Reset state
    this.loading.set(false);
    this.saving.set(false);
    this.error.set(null);
    this.variant.set(null);
    this.originalStops.set([]);
    this.translatedStops.set([]);
    this.form.reset({ language_code: '', title: '' });

    // Load tour data
    this.api.get<any>(`/studio/tours/${this.tourId()}`).subscribe(t => this.tourData.set(t));

    // Load all variants to find the original
    this.api.get<any[]>(`/studio/tours/${this.tourId()}/variants`).subscribe(variants => {
      const original = variants.find((v: any) => v.is_original);
      if (original) {
        this.originalVariantId.set(original.id);
        this.originalLang.set(original.language_code?.toUpperCase() || '');
        // Load original stops
        this.api.get<any[]>(`/studio/tours/${this.tourId()}/variants/${original.id}/stops`).subscribe(
          stops => this.originalStops.set(stops)
        );
      }
    });

    if (!this.isNew()) {
      this.loading.set(true);
      this.api.get<any>(`/studio/tours/${this.tourId()}/variants/${this.variantId()}`).subscribe({
        next: (v) => {
          this.variant.set(v);
          this.form.patchValue({ language_code: v.language_code, title: v.title || '' });
          this.loading.set(false);

          // Load this variant's translated stops
          this.loadTranslatedStops();
        },
        error: () => this.loading.set(false),
      });
    }
  }

  private loadTranslatedStops(): void {
    this.api.get<any[]>(`/studio/tours/${this.tourId()}/variants/${this.variantId()}/stops`).subscribe(
      stops => this.translatedStops.set(stops)
    );
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    const body = this.form.getRawValue();

    const creating = this.isNew();
    const req$ = creating
      ? this.api.post<any>(`/studio/tours/${this.tourId()}/variants`, body)
      : this.api.patch<any>(`/studio/tours/${this.tourId()}/variants/${this.variantId()}`, body);

    req$.subscribe({
      next: (v) => {
        if (creating) {
          // Keep saving=true so the button stays disabled until navigation completes
          this.router.navigateByUrl(`/studio/tours/${this.tourId()}/variants/${v.id}`);
        } else {
          this.saving.set(false);
          this.variant.set(v);
        }
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to save variant.');
        this.saving.set(false);
      },
    });
  }

  // ── Variant metadata translation ─────────────────────────────────────────

  saveMetaTranslation(title: string, description: string): void {
    this.savingMeta.set(true);
    this.metaSaved.set(false);
    this.api.patch<any>(`/studio/tours/${this.tourId()}/variants/${this.variantId()}`, {
      title, description: description || null,
    }).subscribe({
      next: (v) => {
        this.variant.set(v);
        this.savingMeta.set(false);
        this.metaSaved.set(true);
      },
      error: () => this.savingMeta.set(false),
    });
  }

  // ── Translation workspace ──────────────────────────────────────────────

  getTranslatedStop(orderIndex: number): any | null {
    return this.translatedStops().find(s => s.order_index === orderIndex) ?? null;
  }

  saveTranslation(originalStop: any, title: string, description: string): void {
    const existing = this.getTranslatedStop(originalStop.order_index);
    const vid = this.variantId();

    if (existing) {
      // Update existing translated stop
      this.api.patch<any>(
        `/studio/tours/${this.tourId()}/variants/${vid}/stops/${existing.id}`,
        { title, description: description || null }
      ).subscribe(() => this.loadTranslatedStops());
    } else {
      // Create new translated stop at the same order_index
      this.api.post<any>(
        `/studio/tours/${this.tourId()}/variants/${vid}/stops`,
        { title, description: description || null }
      ).subscribe(() => this.loadTranslatedStops());
    }
  }

  onAudioSelect(stopId: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', 'audio');

    this.http.post<any>(
      `${environment.apiUrl}/studio/stops/${stopId}/media/upload`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: () => this.loadTranslatedStops(),
      error: () => this.error.set('Audio upload failed.'),
    });
  }

  uploadRecordedAudio(stopId: string, file: File): void {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', 'audio');

    this.http.post<any>(
      `${environment.apiUrl}/studio/stops/${stopId}/media/upload`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: () => this.loadTranslatedStops(),
      error: () => this.error.set('Audio upload failed.'),
    });
  }

  deleteMedia(stopId: string, mediaId: string): void {
    this.api.delete(`/studio/stops/${stopId}/media/${mediaId}`).subscribe(
      () => this.loadTranslatedStops()
    );
  }

  // ── Translation request ─────────────────────────────────────────

  submitTranslationRequest(): void {
    if (this.requestForm.invalid) return;

    this.postingRequest.set(true);
    this.requestError.set(null);

    const val = this.requestForm.getRawValue();
    const body = {
      tour_id: this.tourId(),
      target_language_code: val.target_language_code,
      description: val.description || null,
      compensation_type: val.compensation_type,
      compensation_value: val.compensation_type === 'fixed'
        ? Math.round(val.compensation_value * 100) // convert EUR to cents
        : val.compensation_value,
      visibility: val.visibility,
      invite_email: val.visibility === 'direct' ? val.invite_email : null,
    };

    this.api.post<any>('/studio/translation-requests', body).subscribe({
      next: () => {
        this.postingRequest.set(false);
        this.requestSuccess.set(true);
      },
      error: (err) => {
        this.requestError.set(err.error?.error ?? 'Failed to post translation request.');
        this.postingRequest.set(false);
      },
    });
  }

  publishVariant(): void {
    this.publishing.set(true);
    this.error.set(null);

    this.api.post<any>(`/studio/tours/${this.tourId()}/variants/${this.variantId()}/publish`).subscribe({
      next: (result) => {
        this.variant.update(v => v ? { ...v, status: result.status } : v);
        this.publishing.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error ?? 'Failed to publish variant.');
        this.publishing.set(false);
      },
    });
  }
}
