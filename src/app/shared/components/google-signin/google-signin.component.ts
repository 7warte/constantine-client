import {
  AfterViewInit, Component, ElementRef, EventEmitter,
  Output, ViewChild, inject, NgZone, ChangeDetectionStrategy,
} from '@angular/core';
import { environment } from '../../../../environments/environment';

// Google Identity Services is loaded from a remote script at runtime.
declare const google: any;

/**
 * Renders the official "Sign in with Google" button and emits the returned
 * ID token (`credential`) for the parent to exchange at POST /api/auth/google.
 */
@Component({
  selector: 'app-google-signin',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #btn class="google-signin"></div>`,
  styles: [`.google-signin { display: flex; justify-content: center; min-height: 40px; }`],
})
export class GoogleSigninComponent implements AfterViewInit {
  @ViewChild('btn', { static: true }) btn!: ElementRef<HTMLDivElement>;
  @Output() credential = new EventEmitter<string>();

  private readonly zone = inject(NgZone);

  ngAfterViewInit(): void {
    this.loadScript()
      .then(() => this.render())
      .catch(() => { /* network/script blocked — button just won't appear */ });
  }

  private loadScript(): Promise<void> {
    if ((window as any).google?.accounts?.id) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('google-gsi') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject());
        return;
      }
      const s = document.createElement('script');
      s.id = 'google-gsi';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject();
      document.head.appendChild(s);
    });
  }

  private render(): void {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (resp: { credential: string }) =>
        this.zone.run(() => this.credential.emit(resp.credential)),
    });
    google.accounts.id.renderButton(this.btn.nativeElement, {
      theme: 'outline',
      size: 'large',
      width: 320,
      text: 'continue_with',
    });
  }
}
