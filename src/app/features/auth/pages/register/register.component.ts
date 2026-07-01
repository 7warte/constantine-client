import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { GoogleSigninComponent } from '../../../../shared/components/google-signin/google-signin.component';

/** Group validator: the two password fields must match. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const pw  = group.get('password')?.value;
  const cpw = group.get('confirm_password')?.value;
  return pw && cpw && pw !== cpw ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ButtonComponent, InputComponent, GoogleSigninComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnInit {
  private readonly fb     = inject(FormBuilder);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route  = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);
  readonly googleError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    display_name:     ['', [Validators.required, Validators.maxLength(80)]],
    username:         ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
    email:            ['', [Validators.required, Validators.email]],
    phone:            ['', [Validators.maxLength(30)]],
    password:         ['', [Validators.required, Validators.minLength(8)]],
    confirm_password: ['', [Validators.required]],
  }, { validators: passwordsMatch });

  ngOnInit(): void {
    // Pre-fill the email when arriving from a gift-claim link (?email=…), so the
    // recipient signs up with the address the tour was gifted to.
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) this.form.controls.email.setValue(email.toLowerCase());
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(null);

    const { confirm_password, ...payload } = this.form.getRawValue();
    this.auth.register(payload).subscribe({
      next:  () => this.router.navigate(['/about']),
      error: (err) => {
        this.error.set(err.error?.error ?? 'Registration failed. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onGoogle(credential: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.googleError.set(null);

    this.auth.loginWithGoogle(credential).subscribe({
      next:  () => this.router.navigate(['/about']),
      error: (err) => {
        this.googleError.set(err.error?.error ?? 'Google sign-in failed. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
