import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { AuditLogger, AuditEventType } from "@/lib/audit-log";
import type Stripe from "stripe";

/**
 * Stripe Webhook Handler
 * Processes payment events from Stripe
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "customer.created":
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      case "customer.deleted":
        await handleCustomerDeleted(event.data.object as Stripe.Customer);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error("Missing userId in subscription metadata");
    return;
  }

  // Get subscription tier from price ID
  const priceId = subscription.items.data[0]?.price.id;
  let tier = "free";

  if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    tier = "pro";
  } else if (priceId === process.env.STRIPE_MANUFACTURER_PRICE_ID) {
    tier = "manufacturer";
  }

  // Create or update subscription record
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      tier,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      tier,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Update user's subscription tier
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier: tier },
  });

  // Log audit event
  await AuditLogger.logPayment({
    eventType: AuditEventType.SUBSCRIPTION_CREATED,
    userId,
    success: true,
    description: `Subscription created: ${tier}`,
    metadata: {
      subscriptionId: subscription.id,
      tier,
      status: subscription.status,
    },
  });
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error("Missing userId in subscription metadata");
    return;
  }

  // Update subscription record
  await prisma.subscription.update({
    where: { userId },
    data: {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Log audit event
  await AuditLogger.logPayment({
    eventType: AuditEventType.SUBSCRIPTION_UPDATED,
    userId,
    success: true,
    description: `Subscription updated: ${subscription.status}`,
    metadata: {
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error("Missing userId in subscription metadata");
    return;
  }

  // Update subscription record
  await prisma.subscription.update({
    where: { userId },
    data: {
      status: "cancelled",
      cancelAtPeriodEnd: true,
    },
  });

  // Downgrade user to free tier
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionTier: "free" },
  });

  // Log audit event
  await AuditLogger.logPayment({
    eventType: AuditEventType.SUBSCRIPTION_CANCELLED,
    userId,
    success: true,
    description: "Subscription cancelled",
    metadata: {
      subscriptionId: subscription.id,
    },
  });
}

/**
 * Handle successful payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription payment
  }

  // Find user by stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`User not found for customer: ${customerId}`);
    return;
  }

  // Log audit event
  await AuditLogger.logPayment({
    eventType: AuditEventType.PAYMENT_SUCCEEDED,
    userId: user.id,
    success: true,
    description: `Payment succeeded: $${(invoice.amount_paid / 100).toFixed(2)}`,
    metadata: {
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
    },
  });
}

/**
 * Handle failed payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = invoice.subscription as string;

  if (!subscriptionId) {
    return; // Not a subscription payment
  }

  // Find user by stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`User not found for customer: ${customerId}`);
    return;
  }

  // Update subscription status
  await prisma.subscription.update({
    where: { userId: user.id },
    data: { status: "past_due" },
  });

  // TODO: Send notification to user about failed payment

  // Log audit event
  await AuditLogger.logPayment({
    eventType: AuditEventType.PAYMENT_FAILED,
    userId: user.id,
    success: false,
    description: `Payment failed: $${(invoice.amount_due / 100).toFixed(2)}`,
    metadata: {
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
    },
  });
}

/**
 * Handle charge refunded
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  const customerId = charge.customer as string;

  // Find user by stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`User not found for customer: ${customerId}`);
    return;
  }

  // Log audit event
  await AuditLogger.logPayment({
    eventType: AuditEventType.REFUND_ISSUED,
    userId: user.id,
    success: true,
    description: `Refund issued: $${(charge.amount_refunded / 100).toFixed(2)}`,
    metadata: {
      chargeId: charge.id,
      amount: charge.amount_refunded,
      currency: charge.currency,
    },
  });
}

/**
 * Handle customer created
 */
async function handleCustomerCreated(customer: Stripe.Customer) {
  const userId = customer.metadata.userId;

  if (!userId) {
    return;
  }

  // Update user with Stripe customer ID
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });
}

/**
 * Handle customer deleted
 */
async function handleCustomerDeleted(customer: Stripe.Customer) {
  const userId = customer.metadata.userId;

  if (!userId) {
    return;
  }

  // Remove Stripe customer ID from user
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: null },
  });
}
