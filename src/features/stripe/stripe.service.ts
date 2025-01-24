import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { DatabaseService } from '../../services/database.service';
import { handleCheckoutSessionCompleted } from './helpers/handleCheckoutSessionCompleted';
import { handleCustomerSubscriptionDeleted } from './helpers/handleCustomerSubscriptionDeleted';
import { handleCustomerSubscriptionUpdated } from './helpers/handleCustomerSubscriptionUpdated';
import { handleInvoicePaymentSucceeded } from './helpers/handleInvoicePaymentSucceeded';

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
    console.log(`Creating checkout session for user ${userId}`);
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

    console.log(`Checkout session created: ${session.id}`);
    return session;
  }

  verifyWebhook(rawBody: Buffer, signature: string) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error(
        'Stripe webhook secret is not set in environment variables',
      );
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
      console.log('Webhook verified successfully.');
      return event;
    } catch (error) {
      console.error('Error verifying webhook:', error.message);
      throw new Error(`Webhook Error: ${error.message}`);
    }
  }

  async handleWebhook(event: Stripe.Event) {
    console.log(`Webhook received: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(
            event,
            this.stripe,
            this.databaseService,
            this.mapPriceToPlan.bind(this),
            this.updateUserProfile.bind(this),
            this.createSubscription.bind(this),
          );
          break;

        case 'invoice.payment_succeeded':
          await handleInvoicePaymentSucceeded(
            event,
            this.databaseService,
            this.mapPlanToTokens.bind(this),
            this.updateUserProfile.bind(this),
          );
          break;

        case 'customer.subscription.deleted':
          await handleCustomerSubscriptionDeleted(event, this.databaseService);
          break;

        case 'customer.subscription.updated':
          await handleCustomerSubscriptionUpdated(event);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error processing webhook ${event.type}:`, error.message);
    }
  }

  // Helper to map plan to tokens
  private mapPlanToTokens(plan: string) {
    const PLAN_TOKENS = {
      basic: { tokens: 30 },
      pro: { tokens: 100 },
      unlimited: { tokens: null },
    };
    return PLAN_TOKENS[plan] || null;
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
        INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, start_date, renewal_date, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING *;
      `;
      const params = [
        userId,
        stripeSubscriptionId,
        plan,
        startDate,
        renewalDate,
      ];

      const result = await this.databaseService.query(query, params);

      if (!result || result.length === 0) {
        console.error(`Failed to create subscription for user ${userId}`);
        throw new Error('Subscription creation failed.');
      }

      console.log(`Subscription created successfully for user ${userId}`);
    } catch (error) {
      console.error('Error creating subscription:', error.message);
      throw error;
    }
  }

  private async updateUserProfile(
    userId: string,
    tier: string,
    newTokens: number | null,
  ) {
    try {
      console.log(
        `Updating profile for user ${userId} to tier=${tier} and tokens=${newTokens}`,
      );
      const queryUpdate = `
        UPDATE profiles
        SET tier = $1, tokens = $2
        WHERE id = $3
        RETURNING *;
      `;
      const params = [tier, newTokens, userId];

      const updateResult = await this.databaseService.query(
        queryUpdate,
        params,
      );

      if (!updateResult || updateResult.length === 0) {
        console.error(`Failed to update profile for user ${userId}`);
        throw new Error('Profile update failed.');
      }

      console.log(`Profile updated successfully for user ${userId}`);
    } catch (error) {
      console.error('Error updating user profile:', error.message);
      throw error;
    }
  }

  private mapPriceToPlan(priceId: string) {
    const PLAN_DETAILS = {
      price_1QgGnlCuDoiqLeJmyZ9pDLpK: { tier: 'basic', tokens: 30 }, //prod
      price_1QgGriCuDoiqLeJmGAIaZu0l: { tier: 'pro', tokens: 100 }, //prod
      price_1QgGsYCuDoiqLeJm4LAVL8ca: { tier: 'unlimited', tokens: null }, //prod
    };

    return PLAN_DETAILS[priceId] || null;
  }
}
