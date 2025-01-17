import Stripe from 'stripe';
import { DatabaseService } from '../../../services/database.service';

interface SubscriptionResult {
  user_id: string;
}

export const handleCustomerSubscriptionDeleted = async (
  event: Stripe.Event,
  databaseService: DatabaseService,
) => {
  const subscription = event.data.object as Stripe.Subscription;
  console.log(
    `Processing subscription deletion for Stripe ID: ${subscription.id}`,
  );

  try {
    const queryUpdateSubscription = `
      UPDATE subscriptions
      SET status = 'canceled', end_date = NOW()
      WHERE stripe_subscription_id = $1
      RETURNING user_id;
    `;
    const result: SubscriptionResult[] = await databaseService.query(
      queryUpdateSubscription,
      [subscription.id],
    );

    if (!result || result.length === 0) {
      console.warn(`No subscription found with Stripe ID: ${subscription.id}`);
      return;
    }

    const userId = result[0].user_id; // TypeScript now recognizes `user_id` exists
    console.log(
      `Updating profile for user ${userId} to tier=free and tokens=0`,
    );

    const queryUpdateProfile = `
      UPDATE profiles
      SET tier = 'free', tokens = 0
      WHERE id = $1
      RETURNING *;
    `;
    const profileUpdateResult = await databaseService.query(
      queryUpdateProfile,
      [userId],
    );

    if (!profileUpdateResult || profileUpdateResult.length === 0) {
      console.error(`Failed to update profile for user ${userId}`);
      return;
    }

    console.log(`Profile successfully updated for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error.message);
  }
};
