import { eq } from "drizzle-orm";
import { clerkClient } from "@nexora/auth/server";
import {
  isProductId,
  resolvePlanForSubscription,
  type Plan,
  type ProductId,
} from "@nexora/billing";
import {
  db,
  productSuspensions,
  subscriptions,
  type AuditEvent,
  type Subscription,
} from "@nexora/database";
import { listOrgEvents, startOfCurrentBillingPeriod } from "@nexora/telemetry";
import { getControllableProducts, type ControllableProduct } from "./products";
import { getUsageByOrg } from "./usage";

export interface ProductUsage {
  product: ControllableProduct;
  plan: Plan;
  subscription: Subscription | null;
  /** Highest used/limit ratio across the product's features — what a summary row needs; the detail page breaks it down per feature. */
  used: number;
  limit: number | null;
  suspended: boolean;
}

export interface CustomerSummary {
  orgId: string;
  name: string;
  slug: string;
  imageUrl: string;
  membersCount: number;
  createdAt: Date;
  products: ProductUsage[];
}

export interface CustomerMember {
  userId: string;
  email: string | null;
  name: string;
  role: string;
}

export interface ProductSuspensionInfo {
  reason: string;
  suspendedBy: string;
  createdAt: Date;
}

export interface CustomerDetail extends CustomerSummary {
  members: CustomerMember[];
  recentEvents: AuditEvent[];
  suspensions: Map<string, ProductSuspensionInfo>;
}

function usageForProducts(
  products: ControllableProduct[],
  subscriptionByProduct: Map<ProductId, Subscription>,
  usageByAction: Map<string, number>,
  suspendedSlugs: Set<string>,
): ProductUsage[] {
  return products.map((product) => {
    // getControllableProducts() derives its list from PLANS' own limit
    // keys (packages/admin/src/products.ts), so every slug here is
    // necessarily one of the billed ProductIds.
    if (!isProductId(product.slug)) {
      throw new Error(`Controllable product "${product.slug}" isn't a billed product.`);
    }
    const subscription = subscriptionByProduct.get(product.slug) ?? null;
    const plan = resolvePlanForSubscription(subscription, product.slug);

    // A product can have several metered features; a customer-facing
    // summary needs one number, so take the feature closest to its limit
    // (most-constrained first) rather than an arbitrary first entry.
    let used = 0;
    let limit: number | null = null;
    let ratio = -1;
    for (const feature of product.features) {
      const featureUsed = usageByAction.get(`${feature}.completed`) ?? 0;
      const featureLimit = plan.limits[feature] ?? null;
      const featureRatio =
        featureLimit === null
          ? featureUsed > 0
            ? 0
            : -1
          : featureUsed / Math.max(featureLimit, 1);
      if (featureRatio > ratio) {
        ratio = featureRatio;
        used = featureUsed;
        limit = featureLimit;
      }
    }
    return {
      product,
      plan,
      subscription,
      used,
      limit,
      suspended: suspendedSlugs.has(product.slug),
    };
  });
}

function groupByProduct(rows: Subscription[]): Map<ProductId, Subscription> {
  const map = new Map<ProductId, Subscription>();
  for (const row of rows) {
    if (isProductId(row.product)) map.set(row.product, row);
  }
  return map;
}

/**
 * Every customer organisation, cross-referenced with its plan and this
 * period's usage per product (§12.3 exception — see the package
 * description). Powers the admin customer list; nothing here is
 * per-request-scoped by org the way every other read model in the
 * platform deliberately is.
 */
export async function listCustomers(): Promise<CustomerSummary[]> {
  const client = await clerkClient();
  // Clerk's page size caps at 500; the platform doesn't have anywhere near
  // that many customers yet, so a single page is enough today. Revisit
  // with real pagination once it isn't (a scale problem, not a design one).
  const { data: organizations } = await client.organizations.getOrganizationList({
    includeMembersCount: true,
    limit: 500,
    orderBy: "-created_at",
  });

  const [subscriptionRows, suspensionRows] = await Promise.all([
    db.select().from(subscriptions),
    db.select().from(productSuspensions),
  ]);
  const subscriptionsByOrg = new Map<string, Subscription[]>();
  for (const row of subscriptionRows) {
    if (!subscriptionsByOrg.has(row.orgId)) subscriptionsByOrg.set(row.orgId, []);
    subscriptionsByOrg.get(row.orgId)!.push(row);
  }
  const suspendedByOrg = new Map<string, Set<string>>();
  for (const row of suspensionRows) {
    if (!suspendedByOrg.has(row.orgId)) suspendedByOrg.set(row.orgId, new Set());
    suspendedByOrg.get(row.orgId)!.add(row.product);
  }

  const controllableProducts = getControllableProducts();
  const allFeatureCompletedActions = controllableProducts.flatMap((p) =>
    p.features.map((f) => `${f}.completed`),
  );
  const usageByOrg = await getUsageByOrg(allFeatureCompletedActions, startOfCurrentBillingPeriod());

  return organizations.map((org) => ({
    orgId: org.id,
    name: org.name,
    slug: org.slug,
    imageUrl: org.imageUrl,
    membersCount: org.membersCount ?? 0,
    createdAt: new Date(org.createdAt),
    products: usageForProducts(
      controllableProducts,
      groupByProduct(subscriptionsByOrg.get(org.id) ?? []),
      usageByOrg.get(org.id) ?? new Map(),
      suspendedByOrg.get(org.id) ?? new Set(),
    ),
  }));
}

/** Same shape as `listCustomers`, for one organisation, plus its members and recent activity — what the customer detail page needs that the list doesn't. */
export async function getCustomer(orgId: string): Promise<CustomerDetail | null> {
  const client = await clerkClient();
  let organization;
  try {
    organization = await client.organizations.getOrganization({
      organizationId: orgId,
      includeMembersCount: true,
    });
  } catch {
    return null;
  }

  const [subscriptionRows, suspensionRows, memberships, recentEvents] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)),
    db.select().from(productSuspensions).where(eq(productSuspensions.orgId, orgId)),
    client.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 }),
    listOrgEvents(orgId, 30),
  ]);

  const suspendedSlugs = new Set(suspensionRows.map((row) => row.product));
  const suspensions = new Map<string, ProductSuspensionInfo>(
    suspensionRows.map((row) => [
      row.product,
      { reason: row.reason, suspendedBy: row.suspendedBy, createdAt: row.createdAt },
    ]),
  );

  const controllableProducts = getControllableProducts();
  const allFeatureCompletedActions = controllableProducts.flatMap((p) =>
    p.features.map((f) => `${f}.completed`),
  );
  const usageByOrg = await getUsageByOrg(allFeatureCompletedActions, startOfCurrentBillingPeriod());

  return {
    orgId: organization.id,
    name: organization.name,
    slug: organization.slug,
    imageUrl: organization.imageUrl,
    membersCount: organization.membersCount ?? memberships.data.length,
    createdAt: new Date(organization.createdAt),
    products: usageForProducts(
      controllableProducts,
      groupByProduct(subscriptionRows),
      usageByOrg.get(orgId) ?? new Map(),
      suspendedSlugs,
    ),
    members: memberships.data.map((membership) => ({
      userId: membership.publicUserData?.userId ?? "",
      email: membership.publicUserData?.identifier ?? null,
      name:
        [membership.publicUserData?.firstName, membership.publicUserData?.lastName]
          .filter(Boolean)
          .join(" ") ||
        (membership.publicUserData?.identifier ?? "Unknown"),
      role: membership.role,
    })),
    recentEvents,
    suspensions,
  };
}

export function findControllableProduct(slug: string): ControllableProduct | undefined {
  return getControllableProducts().find((p) => p.slug === slug);
}
