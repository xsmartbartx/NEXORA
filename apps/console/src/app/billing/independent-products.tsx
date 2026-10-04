import { auth } from "@nexora/auth/server";
import { Badge, Card } from "@nexora/ui";
import { fetchVigiloAccount } from "@/lib/vigilo";

const vigiloUrl = process.env.NEXT_PUBLIC_VIGILO_URL ?? "https://vigilo.onenexora.com";
const neurawallUrl = process.env.NEXT_PUBLIC_NEURAWALL_URL ?? "https://neurawall.onenexora.com";

async function loadVigilo() {
  try {
    const session = await auth();
    const token = await session.getToken({ template: "vigilo-api" });
    return token ? await fetchVigiloAccount(token) : null;
  } catch {
    return null;
  }
}

/**
 * Vigilo and NeuraWall are independently built and hosted, each with its
 * own database and billing logic. Vigilo shares NEXORA's sign-in (same
 * Clerk instance) and Stripe account, so its plan can be shown here; the
 * subscription itself is still managed in Vigilo. NeuraWall has its own
 * operator accounts and is only linked.
 */
export async function IndependentProducts() {
  const vigilo = await loadVigilo();

  return (
    <div>
      <h2 className="text-xl font-semibold">Independent products</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Billed and managed in their own apps. Vigilo uses the same sign-in as this Console.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Vigilo</h3>
            {vigilo ? (
              <Badge variant={vigilo.planId === "free" ? "neutral" : "brand"}>
                {vigilo.planId}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {vigilo
              ? `${vigilo.planId === "free" ? "Free" : "Pro"} plan — ${
                  vigilo.scansPerMonthLimit === null
                    ? "unlimited scans"
                    : `${vigilo.scansPerMonthLimit} scans/month`
                }, ${vigilo.targetsLimit ?? "unlimited"} targets.`
              : "Plan unavailable right now."}
          </p>
          <a href={vigiloUrl} className="mt-3 inline-block text-sm text-link hover:underline">
            Manage in Vigilo &rarr;
          </a>
        </Card>
        <Card>
          <h3 className="font-semibold">NeuraWall</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Uses its own operator accounts; billing is managed in NeuraWall.
          </p>
          <a href={neurawallUrl} className="mt-3 inline-block text-sm text-link hover:underline">
            Open NeuraWall &rarr;
          </a>
        </Card>
      </div>
    </div>
  );
}
