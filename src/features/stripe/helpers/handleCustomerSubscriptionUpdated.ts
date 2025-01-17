import Stripe from 'stripe';

export const handleCustomerSubscriptionUpdated = async (
  event: Stripe.Event,
) => {
  const subscription = event.data.object as Stripe.Subscription;
  console.log(`Processing subscription update for ID: ${subscription.id}`);

  if (subscription.cancel_at_period_end) {
    console.log(
      `Subscription ${subscription.id} set to cancel at the end of the current period.`,
    );
  }
};
