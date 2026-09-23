import type { Metadata } from "next";
import Link from "next/link";
import { LegalDraftNotice } from "@/components/legal-draft-notice";

export const metadata: Metadata = {
  title: "Legal",
  description: "Terms of Service, Privacy Policy and Security Statement.",
};

const documents = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    description: "The agreement governing use of NEXORA's products, accounts and billing.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    description: "What data NEXORA collects, why, and who it's shared with.",
  },
  {
    href: "/legal/security",
    title: "Security Statement",
    description: "The concrete security practices actually built into the platform today.",
  },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Legal
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Legal</h1>
      <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
        The documents governing use of NEXORA&rsquo;s products and platform.
      </p>

      <div className="mt-8">
        <LegalDraftNotice />
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {documents.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/50"
          >
            <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
              {doc.title}
            </h2>
            <p className="text-sm text-muted-foreground">{doc.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
