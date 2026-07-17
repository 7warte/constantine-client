import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { RedirectService } from '../../../../core/auth/redirect.service';
import { internalReturnUrl } from '../../../../core/auth/return-url';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { GoogleSigninComponent } from '../../../../shared/components/google-signin/google-signin.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent, GoogleSigninComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb       = inject(FormBuilder);
  private readonly auth     = inject(AuthService);
  private readonly router   = inject(Router);
  private readonly route    = inject(ActivatedRoute);
  private readonly redirect = inject(RedirectService);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly googleError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next:  () => this.router.navigateByUrl(this.destination()),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Login failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onGoogle(credential: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.googleError.set(null);

    this.auth.loginWithGoogle(credential).subscribe({
      next:  () => this.router.navigateByUrl(this.destination()),
      error: (err) => {
        this.googleError.set(err.error?.error ?? 'Google sign-in failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  /** Where to land after signing in: an explicit ?returnUrl wins, then the page
   *  the user was on before reaching sign-in, then a neutral default. */
  private destination(): string {
    return internalReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))
      ?? this.redirect.previousUrl()
      ?? '/explore';
  }
}
