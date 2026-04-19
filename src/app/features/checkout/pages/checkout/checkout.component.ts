import {
  ChangeDetectionStrategy, Component, OnInit, OnDestroy,
  inject, signal, ElementRef, ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { loadStripe, Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { ApiService } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-checkout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly api    = inject(ApiService);
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private paymentElement: StripePaymentElement | null = null;

  readonly variantId    = this.route.snapshot.paramMap.get('variantId') ?? '';
  readonly variant      = signal<any | null>(null);
  readonly loading      = signal(true);
  readonly paying       = signal(false);
  readonly error        = signal<string | null>(null);
  readonly clientSecret = signal<string | null>(null);

  @ViewChild('paymentElementRef') paymentElementRef!: ElementRef<HTMLDivElement>;

  ngOnInit(): void {
    const tourId = this.route.snapshot.queryParamMap.get('tourId') ?? '';
    this.api.get<any>(`/tours/${tourId}/variants/${this.variantId}`).subscribe({
      next:  v  => { this.variant.set(v); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.paymentElement?.destroy();
  }

  /** Step 1: Create a PaymentIntent (or record free purchase) */
  purchase(): void {
    this.paying.set(true);
    this.error.set(null);

    this.api.post<any>('/purchases', { variant_id: this.variantId }).subscribe({
      next: async (res) => {
        if (res.free) {
          this.router.navigate(['/checkout/confirmation', res.purchase.id]);
          return;
        }
        // Paid variant — mount Stripe Payment Element
        this.clientSecret.set(res.clientSecret);
        this.paying.set(false);
        await this.mountPaymentElement(res.clientSecret);
      },
      error: err => {
        this.error.set(err.error?.error ?? 'Payment failed. Please try again.');
        this.paying.set(false);
      },
    });
  }

  /** Step 2: Confirm the payment via Stripe */
  async confirmPayment(): Promise<void> {
    if (!this.stripe || !this.elements) return;

    this.paying.set(true);
    this.error.set(null);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/confirmation/success?variant_id=${this.variantId}`,
      },
    });

    // If error, Stripe didn't redirect — show the error
    if (error) {
      this.error.set(error.message ?? 'Payment failed. Please try again.');
      this.paying.set(false);
    }
    // On success Stripe redirects to return_url
  }

  private async mountPaymentElement(clientSecret: string): Promise<void> {
    this.stripe = await loadStripe(environment.stripePublishableKey);
    if (!this.stripe) return;

    this.elements = this.stripe.elements({
      clientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#c98a8c',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          borderRadius: '12px',
        },
      },
    });

    // Wait for Angular to render the container
    setTimeout(() => {
      this.paymentElement = this.elements!.create('payment');
      this.paymentElement.mount(this.paymentElementRef.nativeElement);
    });
  }
}
