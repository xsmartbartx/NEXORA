import { Card } from "@nexora/ui";

const neurawallUrl = process.env.NEXT_PUBLIC_NEURAWALL_URL ?? "https://neurawall.onenexora.com";

/**
 * NeuraWall is independently built and hosted, with its own operator accounts
 * and billing, so it is only linked here. (Vigilo is a Core product now: its
 * subscription is on this page with the others.)
 */
export function IndependentProducts() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Independent products</h2>
      <p className="mt-1 text-sm text-muted-foreground">Billed and managed in their own apps.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
