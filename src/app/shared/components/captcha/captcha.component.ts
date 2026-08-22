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
/** Widget methods we call — see altcha's WidgetMethods interface. */
type AltchaWidget = HTMLElement & {
  getState?: () => string;
  reset?: (state?: string, err?: string | null) => void;
  verify?: () => Promise<unknown>;
};

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

  // The widget fetches its challenge once on load. A blip on that request (an
  // edge 504, a dropped connection) used to leave the form permanently
  // unsubmittable until the user reloaded the page, so retry it ourselves.
  private static readonly MAX_RETRIES = 3;
  private retries = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;

  onStateChange(event: Event): void {
    const detail = (event as CustomEvent).detail;
    // eslint-disable-next-line no-console
    console.debug('[captcha] state', detail?.state);
    this.state.set(detail?.state ?? null);
    if (detail?.state !== 'verified' && this.token() !== null) {
      this.token.set(null);
      this.tokenChange.emit(null);
    }
    if (detail?.state === 'error') this.scheduleRetry();
    if (detail?.state === 'verified') this.retries = 0;
  }

  /** Re-fetch the challenge with a short backoff (0.5s, 1s, 2s). */
  private scheduleRetry(): void {
    if (this.retryTimer || this.retries >= CaptchaComponent.MAX_RETRIES) return;
    const delay = 500 * 2 ** this.retries;
    this.retries++;
    // eslint-disable-next-line no-console
    console.debug(`[captcha] challenge failed — retry ${this.retries} in ${delay}ms`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.retryNow();
    }, delay);
  }

  private retryNow(): void {
    const widget = this.widgetRef?.nativeElement as AltchaWidget | undefined;
    if (!widget?.verify) return;
    try {
      widget.reset?.();
      // reset() alone only clears the UI; verify() re-requests the challenge.
      void widget.verify()?.catch(() => {});
    } catch {
      // Swallowed on purpose — a failed retry just leaves the widget in `error`,
      // which schedules the next attempt via onStateChange.
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

  /**
   * Wait up to `timeoutMs` for the captcha to be solved, then return the token.
   * If the widget is sitting in an error state (its challenge request failed),
   * one more attempt is kicked off rather than waiting out the clock for nothing.
   */
  async getToken(timeoutMs = 12_000): Promise<string | null> {
    const start = Date.now();
    let nudged = false;

    while (Date.now() - start < timeoutMs) {
      const t = this.token() ?? this.readPayloadFromDom();
      if (t) return t;

      if (!nudged && this.state() === 'error') {
        nudged = true;
        this.retries = 0;          // the user is actively submitting — try again
        this.retryNow();
      }

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
