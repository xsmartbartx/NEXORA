import { siteConfig } from "@/lib/site-config";

/**
 * Rendered at the top of every /legal page. The text below is real,
 * substantive draft language — not filler — but it was written by an AI
 * assistant, not reviewed by a lawyer, and references entity/jurisdiction
 * fields that don't exist yet (see site-config.ts). This banner is what
 * keeps that draft from being mistaken for something binding: it must stay
 * on every /legal page until a lawyer has actually reviewed the content
 * and this component is deliberately removed.
 */
export function LegalDraftNotice() {
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-4 text-sm text-warning">
      <p className="font-semibold">Draft — not reviewed by a lawyer.</p>
      <p className="mt-1 text-warning/90">
        This document is a starting draft, not a finished legal document. It has not been reviewed
        by a lawyer, references a legal entity and jurisdiction that don&rsquo;t exist yet, and must
        not be treated as binding until reviewed and approved for the jurisdictions NEXORA actually
        operates in. Questions: {siteConfig.legalEmail}.
      </p>
    </div>
  );
}
