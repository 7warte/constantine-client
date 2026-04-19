import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { loadStripe } from '@stripe/stripe-js';
import { ApiService } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-confirmation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent],
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.scss',
})
export class ConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api   = inject(ApiService);

  readonly status = signal<'loading' | 'success' | 'failed'>('loading');

  async ngOnInit(): Promise<void> {
    const purchaseId = this.route.snapshot.paramMap.get('purchaseId');

    // Direct purchase (free tour) — no Stripe involved
    if (purchaseId) {
      this.status.set('success');
      return;
    }

    // Stripe redirect — verify payment and confirm purchase
    const clientSecret = this.route.snapshot.queryParamMap.get('payment_intent_client_secret');
    const paymentIntentId = this.route.snapshot.queryParamMap.get('payment_intent');
    if (!clientSecret) {
      this.status.set('failed');
      return;
    }

    const stripe = await loadStripe(environment.stripePublishableKey);
    if (!stripe) {
      this.status.set('failed');
      return;
    }

    const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
    if (paymentIntent?.status !== 'succeeded') {
      this.status.set('failed');
      return;
    }

    // Confirm the purchase in our backend (fallback if webhook hasn't fired yet)
    this.api.post<any>('/purchases/confirm', {
      payment_intent_id: paymentIntent.id,
    }).subscribe({
      next: () => this.status.set('success'),
      error: () => this.status.set('success'), // payment succeeded even if confirm fails
    });
  }
}
