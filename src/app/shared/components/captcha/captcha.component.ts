import {
  ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA,
  ElementRef, EventEmitter, Output, ViewChild, signal,
} from '@angular/core';
import { environment } from '../../../../environments/environment';
import 'altcha';

/**
 * <app-captcha #cap></app-captcha>
 *
 * Drop-in invisible captcha. The Altcha widget mounts hidden, fetches a fresh
 * challenge from /api/captcha/challenge, runs proof-of-work in a Web Worker,
 * and exposes the solved token via signal + getToken().
 *
 * Usage in any form:
 *
 *   <app-captcha #cap />
 *   ...
 *   async submit() {
 *     const token = await this.cap.getToken();
 *     if (!token) { this.error.set('Captcha failed'); return; }
 *     this.api.post('/some-endpoint', { ..., captcha_token: token });
 *   }
 *
 * Backend route: use `requireCaptcha` middleware OR call `verifySolution(req.body.captcha_token)`.
 */
@Component({
  selector: 'app-captcha',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <altcha-widget
      #widget
      challenge="{{ challengeUrl }}"
      auto="onload"
      hidefooter
      hidelogo
      (statechange)="onStateChange($event)"
      (verified)="onVerified($event)">
    </altcha-widget>
  `,
  styles: [`
    :host {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
    }
  `],
})
export class CaptchaComponent {
  readonly token = signal<string | null>(null);
  readonly state = signal<string | null>(null);

  @Output() readonly tokenChange = new EventEmitter<string | null>();

  readonly challengeUrl = `${environment.apiUrl}/captcha/challenge`;

  @ViewChild('widget') widgetRef?: ElementRef<HTMLElement>;

  onStateChange(event: Event): void {
    const detail = (event as CustomEvent).detail;
    // eslint-disable-next-line no-console
    console.debug('[captcha] state', detail?.state);
    this.state.set(detail?.state ?? null);
    if (detail?.state !== 'verified' && this.token() !== null) {
      this.token.set(null);
      this.tokenChange.emit(null);
    }
  }

  onVerified(event: Event): void {
    const detail = (event as CustomEvent).detail;
    // eslint-disable-next-line no-console
    console.debug('[captcha] verified', detail);
    const payload = typeof detail?.payload === 'string'
      ? detail.payload
      : this.readPayloadFromDom();
    if (payload) {
      this.token.set(payload);
      this.tokenChange.emit(payload);
    }
  }

  /** Wait up to `timeoutMs` for the captcha to be solved, then return the token. */
  async getToken(timeoutMs = 8000): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const t = this.token() ?? this.readPayloadFromDom();
      if (t) return t;
      await new Promise(r => setTimeout(r, 100));
    }
    // eslint-disable-next-line no-console
    console.warn('[captcha] getToken timed out — last state:', this.state());
    return null;
  }

  private readPayloadFromDom(): string | null {
    const host = this.widgetRef?.nativeElement;
    if (!host) return null;
    const input = (host.querySelector('input[name="altcha"]') as HTMLInputElement | null)
      ?? (host.closest('form')?.querySelector('input[name="altcha"]') as HTMLInputElement | null);
    return input?.value || null;
  }
}
