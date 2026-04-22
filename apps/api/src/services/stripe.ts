import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as const })
  : null;

const PLATFORM_FEE_PERCENT = parseInt(
  process.env.PLATFORM_FEE_PERCENT ?? '20',
  10,
);

export function getPlatformFeePercent(): number {
  return PLATFORM_FEE_PERCENT;
}

// ─── Seller Onboarding ────────────────────────────────────────────────────────

/**
 * Creates a Stripe Connect Standard account for a seller.
 */
export async function createConnectAccount(
  email: string,
  userId: string,
): Promise<string> {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured');
  const account = await stripe.accounts.create({
    type: 'standard',
    email,
    metadata: { userId },
  });
  return account.id;
}

/**
 * Generates an account onboarding link for a seller to complete Stripe KYC.
 */
export async function createAccountOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured');
  const link = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: 'account_onboarding',
  });
  return link.url;
}

/**
 * Marks a seller's Stripe onboarding as complete (called after successful link flow).
 */
export async function getAccountStatus(
  accountId: string,
): Promise<{ detailsSubmitted: boolean; chargesEnabled: boolean }> {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured');
  const account = await stripe.accounts.retrieve(accountId);
  return {
    detailsSubmitted: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
  };
}

// ─── Checkout Sessions ────────────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout Session for a photo purchase.
 *
 * @param listing - The photo listing with price and seller info
 * @param buyerEmail - The buyer's email
 * @param orderId - Our internal order ID to store on the payment intent
 * @param successUrl - URL to redirect after successful payment
 * @param cancelUrl - URL to redirect if payment is cancelled
 */
export async function createCheckoutSession({
  listing,
  buyerEmail,
  orderId,
  successUrl,
  cancelUrl,
}: {
  listing: {
    id: string;
    priceUsd: number;
    sellerStripeAccountId: string | null;
  };
  buyerEmail: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ sessionId: string; checkoutUrl: string }> {
  const unitAmount = Math.round(listing.priceUsd * 100); // Convert to cents

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    customer_email: buyerEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: 'SpotterHub Photo License',
            description: `Photo listing ID: ${listing.id}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      orderId,
      listingId: listing.id,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  // If seller has a Stripe account, set up the transfer with application fee
  if (listing.sellerStripeAccountId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: Math.round(unitAmount * (PLATFORM_FEE_PERCENT / 100)),
      transfer_data: {
        destination: listing.sellerStripeAccountId,
      },
    };
  }

  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured');

  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.id || !session.url) {
    throw new Error('Failed to create Stripe Checkout session');
  }

  return { sessionId: session.id, checkoutUrl: session.url };
}

// ─── Webhook Verification ────────────────────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  if (!stripe) throw new Error('STRIPE_SECRET_KEY is not configured');
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}