import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../../core/services/api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly api  = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly fb   = inject(FormBuilder);

  readonly saving         = signal(false);
  readonly success        = signal(false);
  readonly error          = signal<string | null>(null);
  readonly uploadingAvatar = signal(false);
  readonly avatarPreview   = signal<string | null>(null);
  readonly tourCount       = signal(0);
  readonly copied          = signal(false);

  readonly form = this.fb.nonNullable.group({
    display_name: ['', [Validators.required, Validators.maxLength(80)]],
    bio:          ['', Validators.maxLength(500)],
    avatar_url:   [''],
  });

  ngOnInit(): void {
    const user = this.auth.user();
    if (user) {
      this.form.patchValue({
        display_name: user.display_name,
        bio:          user.bio ?? '',
        avatar_url:   user.avatar_url ?? '',
      });
      if (user.avatar_url) this.avatarPreview.set(user.avatar_url);

      // Load published tour count
      this.api.get<any[]>('/studio/tours', { status: 'published' }).subscribe(tours => {
        this.tourCount.set(tours.length);
      });
    }
  }

  get shareUrl(): string {
    const user = this.auth.user();
    return user ? `${window.location.origin}/creators/${user.username}` : '';
  }

  async share(): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    const text = `Check out my audio tours on Constantine!`;
    const url = this.shareUrl;

    if (navigator.share) {
      try {
        await navigator.share({ title: `${user.display_name} on Constantine`, text, url });
      } catch { /* user cancelled */ }
    } else {
      this.copyLink();
    }
  }

  copyLink(): void {
    navigator.clipboard.writeText(this.shareUrl);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  onAvatarSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.uploadingAvatar.set(true);
    this.error.set(null);

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<any>(
      `${environment.apiUrl}/users/me/avatar`,
      formData,
      { headers: { Authorization: `Bearer ${this.auth.token()}` } }
    ).subscribe({
      next: user => {
        this.auth.updateUser(user);
        this.avatarPreview.set(user.avatar_url);
        this.form.patchValue({ avatar_url: user.avatar_url });
        this.uploadingAvatar.set(false);
      },
      error: err => {
        this.error.set(err.error?.error ?? 'Failed to upload avatar.');
        this.uploadingAvatar.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(false);

    this.api.patch<any>('/users/me', this.form.getRawValue()).subscribe({
      next: user => {
        this.auth.updateUser(user);
        this.success.set(true);
        this.saving.set(false);
      },
      error: err => {
        this.error.set(err.error?.error ?? 'Failed to save profile.');
        this.saving.set(false);
      },
    });
  }
}
