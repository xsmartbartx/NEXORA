import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { getPlansForProduct, type PlanTier, type ProductId } from "@nexora/billing/plans";
import { buttonVariants, cn } from "@nexora/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Sentinel, CSPM and Gateway are each free to start, with independent Starter, Pro, Business and Scale tiers. Vigilo starts at $0; NeuraWall plans run from $149 a month to dedicated enterprise deployments. Yearly billing saves up to 20%.",
};

const consoleUrl = process.env.NEXT_PUBLIC_CONSOLE_URL ?? "https://console.onenexora.com";
const vigiloUrl = "https://vigilo.onenexora.com";
const neurawallUrl = "https://neurawall.onenexora.com";

function neurawallSales(plan: string): Tier["cta"] {
  return {
    label: "Contact sales",
    href: `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(`NeuraWall ${plan}`)}`,
  };
}

interface Tier {
  name: string;
  monthlyCents: number;
  yearlyCents: number;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
  /** Replaces the formatted monthly price, e.g. for a quoted range. */
  priceLabel?: string;
  /** Replaces the "or $X / year" line. */
  yearlyNote?: string;
}

interface ProductPricing {
  product: string;
  summary: string;
  tiers: Tier[];
  /** Shown under the tier cards, e.g. professional services. */
  note?: string;
}

function formatLimit(limit: number | null | undefined, unit: string): string {
  return limit === null || limit === undefined
    ? `Unlimited ${unit}`
    : `${limit.toLocaleString("en-US")} ${unit} / month`;
}

const productFeatureLabel: Record<ProductId, string> = {
  sentinel: "Sentinel scans",
  cspm: "CSPM scans",
  gateway: "Gateway requests",
};

const productSummary: Record<ProductId, string> = {
  sentinel: "Paste a log sample, find the anomalies worth a human's attention.",
  cspm: "Paste your cloud config, get real posture findings back.",
  gateway: "A governed, metered front door for every model call your org makes.",
};

// Each product's tiers come from the same plan catalog Console bills and
// Entitlements enforce against, so this page can't drift from them.
// Business is the natural "recommended" tier for most teams; Scale exists
// for the customer who'd otherwise need a custom quote.
function productTiers(product: ProductId): ProductPricing {
  const plans = getPlansForProduct(product);
  const feature = `${product}.scan` in plans[0]!.limits ? `${product}.scan` : "gateway.proxy";
  return {
    product: productLabel[product],
    summary: productSummary[product],
    tiers: plans.map((plan) => ({
      name: plan.name,
      monthlyCents: plan.priceCents.month,
      yearlyCents: plan.priceCents.year,
      features: [
        formatLimit(plan.limits[feature], productFeatureLabel[product]),
        ...(plan.id === "business" ? ["Priority support"] : []),
        ...(plan.id === "scale" ? ["Priority support", "SLA available"] : []),
      ],
      cta:
        plan.id === "free"
          ? { label: "Start free", href: consoleUrl }
          : { label: `Upgrade in Console`, href: `${consoleUrl}/billing` },
      highlighted: plan.id === ("business" satisfies PlanTier),
    })),
  };
}

const productLabel: Record<ProductId, string> = {
  sentinel: "Sentinel",
  cspm: "CSPM",
  gateway: "Gateway",
};

// Vigilo bills separately (its own backend); these mirror PLANS in the
// Vigilo repo's packages/billing/src/vigilo_billing/plans.py.
const products: ProductPricing[] = [
  productTiers("sentinel"),
  productTiers("cspm"),
  productTiers("gateway"),
  {
    product: "Vigilo",
    summary: "Security and compliance scanning for your live web apps.",
    tiers: [
      {
        name: "Free",
        monthlyCents: 0,
        yearlyCents: 0,
        features: ["1 target", "3 scans / month", "Passive checks"],
        cta: { label: "Start free", href: vigiloUrl },
      },
      {
        name: "Pro",
        monthlyCents: 2900,
        yearlyCents: 29000,
        features: [
          "25 targets",
          "Unlimited scans",
          "Active checks on verified targets",
          "Daily monitoring",
          "API access and shareable reports",
          "White-label reports",
        ],
        cta: { label: "Upgrade in Vigilo", href: `${vigiloUrl}/dashboard` },
        highlighted: true,
      },
    ],
  },
  // NeuraWall plans mirror the "Pricing" sheet of NeuraWall_financial_marketing_model_2026.xlsx
  // and NeuraWall's own plan table (neurawall/modules/billing/plans.py), which bills them
  // through Stripe and enforces node, retention and AI limits. Dedicated is sold by sales.
  {
    product: "NeuraWall",
    summary: "AI-assisted firewall with human-approved, signed enforcement policy.",
    tiers: [
      {
        name: "Community",
        monthlyCents: 0,
        yearlyCents: 0,
        features: [
          "1 enforcement node",
          "7-day flow retention",
          "Offline AI advisor",
          "Community support",
          "Self-hosted",
        ],
        cta: { label: "Start free", href: neurawallUrl },
      },
      {
        name: "Pro",
        monthlyCents: 14900,
        yearlyCents: 149000,
        features: [
          "5 enforcement nodes",
          "7-day flow retention",
          "Optional Claude AI (usage billed separately)",
          "Email support, 2 business days",
          "Self-hosted or managed",
        ],
        cta: { label: "Upgrade in NeuraWall", href: `${neurawallUrl}/billing` },
      },
      {
        name: "Business",
        monthlyCents: 49900,
        yearlyCents: 499000,
        features: [
          "25 enforcement nodes",
          "30-day flow retention",
          "Claude AI usage budget included",
          "Priority support, 1 business day",
          "Managed or self-hosted",
        ],
        cta: { label: "Upgrade in NeuraWall", href: `${neurawallUrl}/billing` },
        highlighted: true,
      },
      {
        name: "Enterprise",
        monthlyCents: 300000,
        yearlyCents: 3000000,
        features: [
          "100 enforcement nodes",
          "90-day flow retention",
          "Claude AI usage budget included",
          "SLA and priority support",
          "Managed or self-hosted",
        ],
        cta: { label: "Upgrade in NeuraWall", href: `${neurawallUrl}/billing` },
      },
      {
        name: "Enterprise Dedicated",
        monthlyCents: 500000,
        yearlyCents: 0,
        priceLabel: "$5,000–15,000",
        yearlyNote: "Quoted per deployment",
        features: [
          "Custom node count and retention",
          "Dedicated deployment",
          "Custom AI configuration",
          "SLA and guided onboarding",
        ],
        cta: neurawallSales("Enterprise Dedicated"),
      },
    ],
    note: "Professional services — architecture, deployment and training — at $125 per hour.",
  },
];

function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

/** Computed from the actual numbers rather than a hardcoded "two months free"/"20% off" string, since different products round their annual discount slightly differently. */
function yearlyDiscountPct(monthlyCents: number, yearlyCents: number): number {
  return Math.round((1 - yearlyCents / (monthlyCents * 12)) * 100);
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Pricing
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Pricing</h1>
      <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
        Start free. Upgrade when you need more — monthly, or yearly for a discount. Prices in US
        dollars; cancel anytime.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Using two or three of Sentinel, CSPM and Gateway together?{" "}
        <a href="/bundles" className="text-primary hover:underline">
          Build a bundle
        </a>{" "}
        and check out for one combined, discounted price.
      </p>

      <div className="mt-12 flex flex-col gap-16">
        {products.map((product) => (
          <section key={product.product}>
            <h2 className="text-2xl font-semibold tracking-tight">{product.product}</h2>
            <p className="mt-2 text-muted-foreground">{product.summary}</p>
            <div
              className={cn(
                "mt-6 grid gap-4 sm:grid-cols-2",
                product.tiers.length >= 5
                  ? "lg:grid-cols-5"
                  : product.tiers.length > 2 && "lg:grid-cols-3",
              )}
            >
              {product.tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={cn(
                    "flex flex-col rounded-xl border bg-card p-6",
                    tier.highlighted ? "border-primary/60" : "border-border",
                  )}
                >
                  <h3 className="text-lg font-semibold">{tier.name}</h3>
                  <p className="mt-3">
                    <span className="text-4xl font-semibold tracking-tight">
                      {tier.priceLabel ?? formatUsd(tier.monthlyCents)}
                    </span>
                    <span className="text-muted-foreground"> / month</span>
                  </p>
                  <p className="mt-1 h-5 text-sm text-muted-foreground">
                    {tier.yearlyNote ??
                      (tier.yearlyCents > 0
                        ? `or ${formatUsd(tier.yearlyCents)} / year — save ${yearlyDiscountPct(tier.monthlyCents, tier.yearlyCents)}%`
                        : "")}
                  </p>
                  <ul className="mt-6 flex flex-1 flex-col gap-2 text-sm">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span aria-hidden className="text-primary">
                          ✓
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={tier.cta.href}
                    className={cn(
                      "mt-6",
                      buttonVariants({
                        size: "md",
                        variant: tier.highlighted ? "primary" : "outline",
                      }),
                    )}
                  >
                    {tier.cta.label}
                  </a>
                </div>
              ))}
            </div>
            {product.note && <p className="mt-4 text-sm text-muted-foreground">{product.note}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
