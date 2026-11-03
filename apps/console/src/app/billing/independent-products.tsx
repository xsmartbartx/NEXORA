import { Card } from "@nexora/ui";

const neurawallUrl = process.env.NEXT_PUBLIC_NEURAWALL_URL ?? "https://neurawall.onenexora.com";
const codereviewerUrl =
  process.env.NEXT_PUBLIC_CODEREVIEWER_URL ?? "https://codereviewer.onenexora.com";

/**
 * NeuraWall is built and hosted separately, with its own operator accounts. Its
 * plan can be bought above (an installation linked to this organisation reads it
 * from Core); an installation that bills itself is managed in NeuraWall.
 * CodeReviewer likewise: its plan bought above applies to the GitHub accounts
 * linked to this organisation from CodeReviewer (ADR-0015).
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
            Uses its own operator accounts. Plans bought above apply to an installation linked with
            an API key from API Keys; a standalone installation is billed in NeuraWall.
          </p>
          <a href={neurawallUrl} className="mt-3 inline-block text-sm text-link hover:underline">
            Open NeuraWall &rarr;
          </a>
        </Card>
        <Card>
          <h3 className="font-semibold">CodeReviewer</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Signs in with GitHub. A plan bought above applies to the GitHub accounts linked to this
            organisation: link one from its Billing page in CodeReviewer. An unlinked account is
            billed in CodeReviewer.
          </p>
          <a
            href={`${codereviewerUrl}/dashboard`}
            className="mt-3 inline-block text-sm text-link hover:underline"
          >
            Open CodeReviewer &rarr;
          </a>
        </Card>
      </div>
    </div>
  );
}
