import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../../services/database.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly databaseService: DatabaseService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async createCheckoutSession(
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    userId: string,
  ) {
    console.log('Creating checkout session:', { priceId, userId });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      automatic_tax: {
        enabled: true,
      },
      client_reference_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log('Checkout session created successfully:', session.id);
    return session;
  }

  verifyWebhook(rawBody: Buffer, signature: string) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error(
        'Stripe webhook secret is not set in environment variables',
      );
    }

    console.log('Verifying webhook event...');
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
      console.log('Webhook verified successfully:', event.id);
      return event;
    } catch (error) {
      console.error('Error verifying webhook:', error.message);
      throw new Error(`Webhook Error: ${error.message}`);
    }
  }

  async handleWebhook(event: Stripe.Event) {
    console.log('Handling webhook event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('Checkout session completed:', session.id);
      const userId = session.client_reference_id;

      // Expand line items
      const sessionWithLineItems = await this.stripe.checkout.sessions.retrieve(
        session.id,
        {
          expand: ['line_items'],
        },
      );

      const priceId = sessionWithLineItems.line_items?.data?.[0]?.price?.id;

      console.log('Extracted userId:', userId, 'priceId:', priceId);

      if (!userId || !priceId) {
        console.error('Missing userId or priceId in session.');
        return;
      }

      const plan = this.mapPriceToPlan(priceId);
      console.log('Mapped priceId to plan:', plan);

      if (!plan) {
        console.error('Invalid priceId, no matching plan found.');
        return;
      }

      try {
        await this.updateUserProfile(userId, plan.tier, plan.tokens);
      } catch (error) {
        console.error('Error updating user profile:', error.message);
      }
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private mapPriceToPlan(priceId: string) {
    const PLAN_DETAILS = {
      price_1QbUv4CuDoiqLeJmdmUz8HgV: { tier: 'basic', tokens: 20 },
      price_1QbUwKCuDoiqLeJm4RkK6lTu: { tier: 'pro', tokens: 50 },
      price_1QbUzkCuDoiqLeJmfEpaPWsq: { tier: 'unlimited', tokens: null },
    };

    console.log('Mapping priceId to plan:', priceId);
    return PLAN_DETAILS[priceId];
  }

  private async updateUserProfile(
    userId: string,
    tier: string,
    tokens: number | null,
  ) {
    console.log('Updating user profile:', { userId, tier, tokens });

    try {
      const query = `
        UPDATE profiles
        SET tier = $1, tokens = $2
        WHERE id = $3
        RETURNING *;
      `;
      const params = [tier, tokens, userId];

      console.log('Executing query with params:', params);

      const result = await this.databaseService.query(query, params);

      if (!result || result.length === 0) {
        console.error('No rows updated for user:', userId);
        throw new Error('Failed to update user profile. No rows updated.');
      }

      console.log('User profile updated successfully:', result[0]);
    } catch (error) {
      console.error('Error updating user profile:', error.message);
      throw new Error('Failed to update user profile');
    }
  }
}
