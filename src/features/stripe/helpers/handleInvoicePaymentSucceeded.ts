import Stripe from 'stripe';
import { DatabaseService } from '../../../services/database.service';

interface SubscriptionResult {
  user_id: string;
  plan: string;
  first_charge_handled: boolean;
}

export const handleInvoicePaymentSucceeded = async (
  event: Stripe.Event,
  databaseService: DatabaseService,
  mapPlanToTokens: (plan: string) => { tokens: number } | null,
  updateUserProfile: (
    userId: string,
    plan: string,
    tokens: number,
  ) => Promise<void>,
) => {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = invoice.subscription as string;

  console.log(
    `Processing invoice.payment_succeeded for Subscription ID: ${subscriptionId}`,
  );

  try {
    const queryGetSubscription = `
      SELECT user_id, plan, first_charge_handled
      FROM subscriptions
      WHERE stripe_subscription_id = $1 AND status = 'active';
    `;
    const result: SubscriptionResult[] = await databaseService.query(
      queryGetSubscription,
      [subscriptionId],
    );

    if (!result || result.length === 0) {
      console.warn(
        `No active subscription found for Subscription ID: ${subscriptionId}`,
      );
      return;
    }

    const { user_id: userId, plan, first_charge_handled } = result[0];

    if (!first_charge_handled) {
      console.log(
        `Skipping token addition for first invoice of subscription: ${subscriptionId}`,
      );
      const queryMarkFirstCharge = `
        UPDATE subscriptions SET first_charge_handled = true WHERE stripe_subscription_id = $1;
      `;
      await databaseService.query(queryMarkFirstCharge, [subscriptionId]);
      console.log(
        `Marked first charge as handled for subscription ${subscriptionId}`,
      );
      return;
    }

    const planDetails = mapPlanToTokens(plan);
    if (!planDetails) {
      console.error(`Invalid plan: ${plan}`);
      return;
    }

    console.log(
      `Updating user profile for user ${userId} with tokens: ${planDetails.tokens}`,
    );
    await updateUserProfile(userId, plan, planDetails.tokens);
    console.log(`Successfully updated tokens for user ${userId}`);
  } catch (error) {
    console.error('Error handling invoice.payment_succeeded:', error.message);
  }
};
