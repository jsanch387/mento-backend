import Stripe from 'stripe';
import { DatabaseService } from '../../../services/database.service';

export const handleCheckoutSessionCompleted = async (
  event: Stripe.Event,
  stripe: Stripe,
  databaseService: DatabaseService,
  mapPriceToPlan: (
    priceId: string,
  ) => { tier: string; tokens: number | null } | null,
  updateUserProfile: (
    userId: string,
    tier: string,
    tokens: number | null,
  ) => Promise<void>,
  createSubscription: (
    userId: string,
    subscriptionId: string,
    tier: string,
    startDate: Date,
    renewalDate: Date | null,
  ) => Promise<void>,
) => {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.client_reference_id;

  const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
    session.id,
    {
      expand: ['line_items', 'subscription'],
    },
  );

  const priceId = sessionWithLineItems.line_items?.data?.[0]?.price?.id;
  const subscription = sessionWithLineItems.subscription as Stripe.Subscription;

  if (!userId || !priceId || !subscription?.id) {
    console.error('Missing userId, priceId, or subscription in session.');
    return;
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    console.error(`Invalid priceId: ${priceId}. No matching plan found.`);
    return;
  }

  try {
    await updateUserProfile(userId, plan.tier, plan.tokens);

    const startDate = new Date(subscription.current_period_start * 1000);
    const renewalDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;

    await createSubscription(
      userId,
      subscription.id,
      plan.tier,
      startDate,
      renewalDate,
    );
  } catch (error) {
    console.error('Error handling checkout.session.completed:', error.message);
  }
};
