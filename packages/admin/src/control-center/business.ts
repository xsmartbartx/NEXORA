import { sql } from "drizzle-orm";
import { clerkClient } from "@nexora/auth/server";
import { getStripeClient, isStripeConfigured } from "@nexora/billing";
import { db } from "@nexora/database";
import { NotConnected } from "./result";

export interface ClerkSummary {
  users: number;
  organizations: number;
  newUsers7d: number;
  newUsers30d: number;
  /** True when the 100 newest users were all inside the window, so the real count is higher. */
  newUsersCapped: boolean;
}

const DAY_MS = 86_400_000;

/** Counts of users created inside a window, from a newest-first page. */
export function countRecent(createdAtMs: number[], now: number = Date.now()) {
  const within = (days: number) => createdAtMs.filter((t) => now - t <= days * DAY_MS).length;
  return {
    newUsers7d: within(7),
    newUsers30d: within(30),
    newUsersCapped: createdAtMs.length >= 100 && within(30) === createdAtMs.length,
  };
}

export async function collectClerk(): Promise<ClerkSummary> {
  if (!process.env.CLERK_SECRET_KEY) {
    throw new NotConnected("Clerk", "Set CLERK_SECRET_KEY.");
  }
  const client = await clerkClient();
  const [users, organizations, recent] = await Promise.all([
    client.users.getCount(),
    client.organizations.getOrganizationList({ limit: 1 }),
    client.users.getUserList({ orderBy: "-created_at", limit: 100 }),
  ]);
  return {
    users,
    organizations: organizations.totalCount,
    ...countRecent(recent.data.map((user) => user.createdAt)),
  };
}

/** The fields of a Stripe subscription that MRR is computed from — kept structural so the maths is testable without the SDK. */
export interface SubscriptionLike {
  customer: string | { id: string };
  items: {
    data: {
      quantity?: number | null;
      price: {
        currency: string;
        unit_amount: number | null;
        recurring: { interval: string; interval_count: number } | null;
      };
    }[];
  };
  /** Expanded discounts; newer Stripe API versions nest the coupon under `source`. */
  discounts?: unknown[];
}

const INTERVAL_MONTHS: Record<string, number> = {
  day: 12 / 365,
  week: 12 / 52,
  month: 1,
  year: 12,
};

/** Price per billing period, normalised to a month. Unknown intervals are rejected rather than guessed at. */
export function monthlyCents(
  unitAmount: number,
  interval: string,
  intervalCount: number,
  quantity: number,
): number {
  const months = INTERVAL_MONTHS[interval];
  if (months === undefined || intervalCount < 1)
    throw new Error(`unsupported interval ${interval}`);
  return (unitAmount * quantity) / (months * intervalCount);
}

interface CouponLike {
  percent_off?: number | null;
  amount_off?: number | null;
}

function couponOf(discount: unknown): CouponLike | null {
  const d = discount as { coupon?: CouponLike; source?: { coupon?: CouponLike } } | null;
  if (typeof d !== "object" || d === null) return null;
  return d.coupon ?? d.source?.coupon ?? null;
}

/** Fraction of the price that remains after percentage discounts. Fixed-amount discounts aren't modelled — see `discountsIgnored`. */
export function discountMultiplier(discounts: unknown[] | undefined): {
  multiplier: number;
  ignored: number;
} {
  let multiplier = 1;
  let ignored = 0;
  for (const discount of discounts ?? []) {
    const coupon = couponOf(discount);
    if (!coupon) {
      ignored += 1; // an unexpanded id, or a shape we don't recognise
    } else if (typeof coupon.percent_off === "number") {
      multiplier *= 1 - coupon.percent_off / 100;
    } else if (coupon.amount_off) {
      ignored += 1;
    }
  }
  return { multiplier, ignored };
}

export interface RevenueSummary {
  activeSubscriptions: number;
  payingCustomers: number;
  mrrCents: number;
  arrCents: number;
  pastDue: number;
  /** Discounts present but not subtracted (fixed-amount, or unrecognised) — MRR is overstated by at most this many. */
  discountsIgnored: number;
  /** Non-USD subscriptions left out of MRR. */
  nonUsdSkipped: number;
}

export function summarizeSubscriptions(
  active: SubscriptionLike[],
  pastDue: number,
): RevenueSummary {
  let mrr = 0;
  let discountsIgnored = 0;
  let nonUsdSkipped = 0;
  const customers = new Set<string>();

  for (const subscription of active) {
    const { multiplier, ignored } = discountMultiplier(subscription.discounts);
    discountsIgnored += ignored;

    let counted = false;
    for (const item of subscription.items.data) {
      const { price } = item;
      if (price.unit_amount === null || !price.recurring) continue;
      if (price.currency !== "usd") {
        nonUsdSkipped += 1;
        continue;
      }
      mrr +=
        monthlyCents(
          price.unit_amount,
          price.recurring.interval,
          price.recurring.interval_count,
          item.quantity ?? 1,
        ) * multiplier;
      counted = true;
    }
    if (counted) {
      customers.add(
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
      );
    }
  }

  const mrrCents = Math.round(mrr);
  return {
    activeSubscriptions: active.length,
    payingCustomers: customers.size,
    mrrCents,
    arrCents: mrrCents * 12,
    pastDue,
    discountsIgnored,
    nonUsdSkipped,
  };
}

/** Live from Stripe, not the local subscriptions table: that table doesn't record the billing interval or any discount, so it can't give real MRR. */
export async function collectRevenue(): Promise<RevenueSummary> {
  if (!isStripeConfigured()) throw new NotConnected("Stripe", "Set STRIPE_SECRET_KEY.");

  const stripe = getStripeClient();
  const [active, pastDue] = await Promise.all([
    stripe.subscriptions
      .list({ status: "active", limit: 100, expand: ["data.discounts"] })
      .autoPagingToArray({ limit: 2000 }),
    stripe.subscriptions
      .list({ status: "past_due", limit: 100 })
      .autoPagingToArray({ limit: 2000 }),
  ]);
  return summarizeSubscriptions(active as unknown as SubscriptionLike[], pastDue.length);
}

export interface ActivationSummary {
  /** Organisations that created at least one API key. */
  orgsWithKeys: number;
  /** ...and have used one at least once. */
  activatedOrgs: number;
  activeLast7d: number;
  activeKeys: number;
}

/** "Activated" = made at least one authenticated API call, the first moment an org is actually using the platform rather than just signed up. */
export async function collectActivation(): Promise<ActivationSummary> {
  const rows = await db.execute<{
    orgs_with_keys: string;
    activated: string;
    active_7d: string;
    active_keys: string;
  }>(sql`
    select
      count(distinct org_id) as orgs_with_keys,
      count(distinct org_id) filter (where last_used_at is not null) as activated,
      count(distinct org_id) filter (where last_used_at >= now() - interval '7 days') as active_7d,
      count(*) filter (where revoked_at is null) as active_keys
    from api_keys
  `);
  const row = rows[0];
  return {
    orgsWithKeys: Number(row?.orgs_with_keys ?? 0),
    activatedOrgs: Number(row?.activated ?? 0),
    activeLast7d: Number(row?.active_7d ?? 0),
    activeKeys: Number(row?.active_keys ?? 0),
  };
}
