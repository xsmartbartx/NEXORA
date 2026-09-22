import type { Metadata } from "next";
import { buttonVariants } from "@nexora/ui";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Company",
  description: "NEXORA is a technology platform for AI, security and cloud products.",
};

export default function CompanyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Company
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">About NEXORA</h1>

      <div className="mt-8 flex flex-col gap-4 text-foreground/90">
        <p>
          NEXORA is a technology platform, not a portfolio of unrelated apps. Its products —
          spanning AI, security and cloud — are built as tenants of a single shared backbone: one
          account, one console, one API surface, one operational layer.
        </p>
        <p>
          The reasoning is deliberate: a standalone product adds one unit of value. A platform adds
          one unit of value and reduces the cost of every product that follows it. That is the bet
          NEXORA is built on — platform first, product second.
        </p>
        <p>
          NEXORA is early. The platform foundation and this website are live; the first products are
          in Labs, being built in the open rather than announced ahead of working software.
        </p>
      </div>

      <div id="contact" className="mt-16 scroll-mt-24 rounded-xl border border-border bg-card p-8">
        <h2 className="text-xl font-semibold">Get in touch</h2>
        <p className="mt-2 max-w-lg text-muted-foreground">
          For partnership, early access or anything else — email is the fastest way to reach us
          while the console and self-serve sign-up are still being built.
        </p>
        <a
          href={`mailto:${siteConfig.contactEmail}`}
          className={buttonVariants({ size: "lg", className: "mt-6" })}
        >
          {siteConfig.contactEmail}
        </a>
      </div>
    </div>
  );
}
