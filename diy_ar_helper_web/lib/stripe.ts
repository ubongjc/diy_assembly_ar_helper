import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
});

/**
 * Subscription Plans
 */
export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: "free",
    name: "Free",
    price: 0,
    stripePriceId: null,
    features: [
      "Browse public manuals",
      "Basic AR guidance",
      "Up to 3 sessions per month",
      "Community support",
    ],
  },
  PRO: {
    id: "pro",
    name: "Pro",
    price: 9.99,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID!,
    features: [
      "Unlimited sessions",
      "Advanced AR features",
      "Part detection",
      "Hand placement hints",
      "Offline packs",
      "Priority support",
      "No ads",
    ],
  },
  MANUFACTURER: {
    id: "manufacturer",
    name: "Manufacturer",
    price: 49.99,
    stripePriceId: process.env.STRIPE_MANUFACTURER_PRICE_ID!,
    features: [
      "All Pro features",
      "Manufacturer portal",
      "API access",
      "Custom branding",
      "Analytics dashboard",
      "White-label option",
      "Dedicated support",
    ],
  },
} as const;

/**
 * Create a Stripe customer
 */
export async function createStripeCustomer(params: {
  email: string;
  name?: string;
  userId: string;
}): Promise<Stripe.Customer> {
  return await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      userId: params.userId,
    },
  });
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  return await stripe.checkout.sessions.create({
    customer: params.customerId,
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    automatic_tax: {
      enabled: true,
    },
    subscription_data: {
      trial_period_days: 7, // 7-day free trial
      metadata: params.metadata,
    },
  });
}

/**
 * Create a billing portal session
 */
export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  } else {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
}

/**
 * Reactivate a subscription
 */
export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Create a usage record (for metered billing)
 */
export async function createUsageRecord(params: {
  subscriptionItemId: string;
  quantity: number;
  timestamp?: number;
}): Promise<Stripe.UsageRecord> {
  return await stripe.subscriptionItems.createUsageRecord(
    params.subscriptionItemId,
    {
      quantity: params.quantity,
      timestamp: params.timestamp || Math.floor(Date.now() / 1000),
    }
  );
}

/**
 * Create a refund
 */
export async function createRefund(params: {
  paymentIntentId: string;
  amount?: number;
  reason?: Stripe.RefundCreateParams.Reason;
}): Promise<Stripe.Refund> {
  return await stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amount,
    reason: params.reason,
  });
}

/**
 * Create a promo code
 */
export async function createPromoCode(params: {
  couponId: string;
  code: string;
  maxRedemptions?: number;
  expiresAt?: number;
}): Promise<Stripe.PromotionCode> {
  return await stripe.promotionCodes.create({
    coupon: params.couponId,
    code: params.code,
    max_redemptions: params.maxRedemptions,
    expires_at: params.expiresAt,
  });
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Get customer details
 */
export async function getCustomer(
  customerId: string
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) {
    throw new Error("Customer has been deleted");
  }
  return customer;
}

/**
 * List customer subscriptions
 */
export async function listCustomerSubscriptions(
  customerId: string
): Promise<Stripe.Subscription[]> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 100,
  });
  return subscriptions.data;
}

/**
 * Construct webhook event from request
 */
export function constructWebhookEvent(
  body: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(body, signature, secret);
}

/**
 * Check if customer has active subscription
 */
export async function hasActiveSubscription(
  customerId: string
): Promise<boolean> {
  const subscriptions = await listCustomerSubscriptions(customerId);
  return subscriptions.some((sub) => sub.status === "active");
}

/**
 * Get customer's current plan
 */
export async function getCustomerPlan(
  customerId: string
): Promise<string | null> {
  const subscriptions = await listCustomerSubscriptions(customerId);
  const activeSub = subscriptions.find((sub) => sub.status === "active");

  if (!activeSub) {
    return null;
  }

  const priceId = activeSub.items.data[0]?.price.id;

  // Match price ID to plan
  if (priceId === SUBSCRIPTION_PLANS.PRO.stripePriceId) {
    return "pro";
  } else if (priceId === SUBSCRIPTION_PLANS.MANUFACTURER.stripePriceId) {
    return "manufacturer";
  }

  return null;
}
