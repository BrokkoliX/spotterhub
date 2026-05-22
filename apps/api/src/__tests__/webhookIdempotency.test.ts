import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { cleanDatabase, prisma, setupTestServer, teardownTestServer } from './testHelpers.js';

let server: Awaited<ReturnType<typeof setupTestServer>>;

beforeAll(async () => {
  server = await setupTestServer();
});

afterAll(async () => {
  await teardownTestServer(server);
});

beforeEach(cleanDatabase);

// ─── Webhook idempotency contract ────────────────────────────────────────────
//
// The Stripe webhook handler in apps/api/src/index.ts relies on a unique
// constraint on `webhook_events.stripe_event_id` to short-circuit duplicate
// deliveries. These tests exercise the contract directly so a regression to
// the schema (e.g. dropping the unique constraint) is caught immediately.
//
// A full HTTP-level integration test would require lifting the webhook
// handler out of the express bootstrap into a callable function. That is
// tracked as a Sprint 4 follow-up; the contract tests below provide
// sufficient coverage that the idempotency strategy works at the database
// layer.
describe('WebhookEvent idempotency', () => {
  it('first insertion of a Stripe event ID succeeds', async () => {
    const result = await prisma.webhookEvent.create({
      data: { stripeEventId: 'evt_test_first_delivery' },
    });

    expect(result.stripeEventId).toBe('evt_test_first_delivery');
    expect(result.id).toBeDefined();
  });

  it('duplicate Stripe event ID throws on the unique constraint', async () => {
    await prisma.webhookEvent.create({
      data: { stripeEventId: 'evt_test_duplicate' },
    });

    await expect(
      prisma.webhookEvent.create({
        data: { stripeEventId: 'evt_test_duplicate' },
      }),
    ).rejects.toThrow();
  });

  it('different Stripe event IDs do not conflict', async () => {
    await prisma.webhookEvent.create({
      data: { stripeEventId: 'evt_a' },
    });
    await prisma.webhookEvent.create({
      data: { stripeEventId: 'evt_b' },
    });

    const count = await prisma.webhookEvent.count();
    expect(count).toBe(2);
  });

  it('simulates the handler short-circuit: catch the duplicate-key error and respond 200', async () => {
    // This mirrors the handler logic in apps/api/src/index.ts:
    //   try { await prisma.webhookEvent.create(...) }
    //   catch { res.json({ received: true }); return; }
    const eventId = 'evt_handler_simulation';
    let firstSucceeded = false;
    let secondSucceeded = false;

    try {
      await prisma.webhookEvent.create({ data: { stripeEventId: eventId } });
      firstSucceeded = true;
    } catch {
      // first delivery should not throw
    }

    try {
      await prisma.webhookEvent.create({ data: { stripeEventId: eventId } });
      secondSucceeded = true;
    } catch {
      // expected — duplicate is the trigger for the 200 short-circuit
    }

    expect(firstSucceeded).toBe(true);
    expect(secondSucceeded).toBe(false);

    // And only one row exists
    const count = await prisma.webhookEvent.count({
      where: { stripeEventId: eventId },
    });
    expect(count).toBe(1);
  });
});
