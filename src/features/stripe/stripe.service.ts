import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../../services/database.service';

interface Profile {
  tokens: number | null;
  tier: string;
}

interface SubscriptionResult {
  user_id: string;
}

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
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      automatic_tax: { enabled: true },
      client_reference_id: userId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session;
  }

  verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook secret is not set.');
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
      return event;
    } catch (error) {
      console.error('Error verifying webhook:', error.message);
      throw new Error(`Webhook Error: ${error.message}`);
    }
  }

  private async updateUserProfile(
    userId: string,
    tier: string,
    tokensToAdd: number,
  ): Promise<Profile> {
    console.log(`Fetching current profile for user: ${userId}`);

    const queryGetProfile = `SELECT tokens, tier FROM profiles WHERE id = $1;`;
    const profile: Profile[] = await this.databaseService.query(
      queryGetProfile,
      [userId],
    );

    if (!profile || profile.length === 0) {
      throw new Error(`User profile not found for user ID: ${userId}`);
    }

    const currentTokens = profile[0].tokens ?? 0;
    const currentTier = profile[0].tier;

    console.log(
      `Current profile for user ${userId}: Tier=${currentTier}, Tokens=${currentTokens}`,
    );

    // Add tokens based on the plan
    const updatedTokens = currentTokens + tokensToAdd;
    console.log(
      `Adding ${tokensToAdd} tokens to current balance (${currentTokens}) for user ${userId}. New balance: ${updatedTokens}`,
    );

    const queryUpdateProfile = `
      UPDATE profiles
      SET tier = $1, tokens = $2
      WHERE id = $3
      RETURNING *;
    `;

    console.log(
      `Updating profile for user ${userId} with Tier=${tier} and Tokens=${updatedTokens}`,
    );
    const updatedProfile: Profile[] = await this.databaseService.query(
      queryUpdateProfile,
      [tier, updatedTokens, userId],
    );

    if (!updatedProfile || updatedProfile.length === 0) {
      throw new Error(`Failed to update profile for user ID: ${userId}`);
    }

    console.log(
      `Profile updated successfully for user ${userId}: ${JSON.stringify(updatedProfile[0])}`,
    );
    return updatedProfile[0];
  }

  private async createSubscription(
    userId: string,
    stripeSubscriptionId: string,
    plan: string,
    startDate: Date,
    renewalDate: Date | null,
  ): Promise<void> {
    console.log(
      `Checking if subscription with StripeSubscriptionID=${stripeSubscriptionId} exists.`,
    );

    const queryCheckSubscription = `
      SELECT id FROM subscriptions WHERE stripe_subscription_id = $1;
    `;
    const existingSubscription = await this.databaseService.query(
      queryCheckSubscription,
      [stripeSubscriptionId],
    );

    if (existingSubscription.length > 0) {
      console.log(
        `Subscription with StripeSubscriptionID=${stripeSubscriptionId} already exists. Skipping creation.`,
      );
      return;
    }

    console.log(`Creating new subscription entry for user ${userId}.`);
    const queryInsertSubscription = `
      INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, start_date, renewal_date, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *;
    `;
    const result = await this.databaseService.query(queryInsertSubscription, [
      userId,
      stripeSubscriptionId,
      plan,
      startDate,
      renewalDate,
    ]);

    console.log(
      `Subscription created successfully for user ${userId}: ${JSON.stringify(result[0])}`,
    );
  }

  async handleWebhook(event: Stripe.Event) {
    console.log(`Webhook received: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;

      console.log(`Processing checkout session completed for user: ${userId}`);

      const sessionWithDetails = await this.stripe.checkout.sessions.retrieve(
        session.id,
        {
          expand: ['line_items', 'subscription'],
        },
      );

      const priceId = sessionWithDetails.line_items?.data?.[0]?.price?.id;
      const subscription =
        sessionWithDetails.subscription as Stripe.Subscription;

      console.log(
        `Session details - Price ID: ${priceId}, Subscription ID: ${subscription?.id}`,
      );

      if (!userId || !priceId || !subscription) {
        console.error('Missing details for subscription update.');
        return;
      }

      const plan = this.mapPriceToPlan(priceId);
      if (!plan) {
        console.error(`Invalid price ID: ${priceId}`);
        return;
      }

      const { tier, tokens } = plan;

      try {
        console.log(
          `Updating profile for user ${userId} with Plan Tier=${tier} and Tokens=${tokens}`,
        );
        await this.updateUserProfile(userId, tier, tokens);

        console.log(
          `Creating subscription entry for user ${userId} with Subscription ID=${subscription.id}`,
        );
        await this.createSubscription(
          userId,
          subscription.id,
          tier,
          new Date(subscription.current_period_start * 1000),
          subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        );
      } catch (error) {
        console.error(
          `Error processing subscription for user ${userId}:`,
          error.message,
        );
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;

      console.log(
        `Processing subscription cancellation for Stripe ID: ${subscription.id}`,
      );
      const stripeSubscriptionId = subscription.id;

      const queryUpdateSubscription = `
        UPDATE subscriptions
        SET status = 'canceled', end_date = NOW()
        WHERE stripe_subscription_id = $1
        RETURNING user_id;
      `;
      const result: SubscriptionResult[] = await this.databaseService.query(
        queryUpdateSubscription,
        [stripeSubscriptionId],
      );

      if (!result || result.length === 0) {
        console.warn(
          `No subscription found with Stripe ID: ${stripeSubscriptionId}`,
        );
        return;
      }

      const userId = result[0].user_id;
      console.log(`Switching profile to free for user ${userId}`);
      const queryUpdateProfile = `
        UPDATE profiles
        SET tier = 'free'
        WHERE id = $1
        RETURNING *;
      `;
      await this.databaseService.query(queryUpdateProfile, [userId]);
    } else {
      console.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private mapPriceToPlan(priceId: string) {
    const PLANS = {
      price_1BasicPlanID: { tier: 'basic', tokens: 15 }, // Replace with actual Basic Plan ID
      price_1ProPlanID: { tier: 'pro', tokens: 50 }, // Replace with actual Pro Plan ID
    };
    return PLANS[priceId];
  }
}
