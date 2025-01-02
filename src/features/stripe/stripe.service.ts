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

  private async createSubscription(
    userId: string,
    stripeSubscriptionId: string,
    plan: string,
    startDate: Date,
    renewalDate: Date | null,
  ) {
    try {
      const query = `
        INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, start_date, renewal_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const params = [
        userId,
        stripeSubscriptionId,
        plan,
        startDate,
        renewalDate,
      ];

      console.log('Creating subscription with params:', params);

      const result = await this.databaseService.query(query, params);

      if (!result || result.length === 0) {
        console.error('Failed to create subscription for user:', userId);
        throw new Error('Subscription creation failed.');
      }

      console.log('Subscription created successfully:', result[0]);
    } catch (error) {
      console.error('Error creating subscription:', error.message);
      throw new Error('Failed to create subscription.');
    }
  }

  async handleWebhook(event: Stripe.Event) {
    console.log('Handling webhook event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log('Checkout session completed:', session.id);
      const userId = session.client_reference_id;

      // Expand subscription
      const sessionWithLineItems = await this.stripe.checkout.sessions.retrieve(
        session.id,
        {
          expand: ['line_items', 'subscription'],
        },
      );

      const priceId = sessionWithLineItems.line_items?.data?.[0]?.price?.id;
      const subscription =
        sessionWithLineItems.subscription as Stripe.Subscription;

      console.log(
        'Extracted userId:',
        userId,
        'priceId:',
        priceId,
        'subscription:',
        subscription?.id,
      );

      if (!userId || !priceId || !subscription?.id) {
        console.error('Missing userId, priceId, or subscription in session.');
        return;
      }

      const plan = this.mapPriceToPlan(priceId);
      console.log('Mapped priceId to plan:', plan);

      if (!plan) {
        console.error('Invalid priceId, no matching plan found.');
        return;
      }

      try {
        // Update user profile
        await this.updateUserProfile(userId, plan.tier, plan.tokens);

        // Create a new subscription in the database
        const startDate = new Date(subscription.current_period_start * 1000);
        const renewalDate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;

        await this.createSubscription(
          userId,
          subscription.id,
          plan.tier,
          startDate,
          renewalDate,
        );
      } catch (error) {
        console.error('Error handling subscription:', error.message);
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
    newTokens: number | null,
  ) {
    console.log('Updating user profile:', { userId, tier, newTokens });

    try {
      // Step 1: Retrieve the current token balance
      const queryGet = `
        SELECT tokens FROM profiles WHERE id = $1;
      `;
      const result = await this.databaseService.query(queryGet, [userId]);

      if (!result || result.length === 0) {
        console.error(`User with ID ${userId} not found.`);
        throw new Error('User profile not found.');
      }

      // Typecast result to ensure TypeScript knows its structure
      const currentProfile = result[0] as { tokens: number | null };

      const currentTokens = currentProfile.tokens || 0;

      console.log(`Current tokens: ${currentTokens}, New tokens: ${newTokens}`);

      // Step 2: Calculate the new token balance
      const updatedTokens =
        newTokens !== null ? currentTokens + newTokens : null;

      // Step 3: Update the profile with the new tier and token balance
      const queryUpdate = `
        UPDATE profiles
        SET tier = $1, tokens = $2
        WHERE id = $3
        RETURNING *;
      `;
      const params = [tier, updatedTokens, userId];

      console.log('Executing query with params:', params);

      const updateResult = await this.databaseService.query(
        queryUpdate,
        params,
      );

      if (!updateResult || updateResult.length === 0) {
        console.error('No rows updated for user:', userId);
        throw new Error('Failed to update user profile. No rows updated.');
      }

      console.log('User profile updated successfully:', updateResult[0]);
    } catch (error) {
      console.error('Error updating user profile:', error.message);
      throw new Error('Failed to update user profile');
    }
  }
}
