import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { LegalDraftNotice } from "@/components/legal-draft-notice";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data NEXORA collects, why, and who it's shared with.",
};

const h2 = "mt-10 text-xl font-semibold text-foreground";
const p = "mt-3 text-sm leading-relaxed text-foreground/90";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Legal
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Draft — Effective date: [NOT YET PUBLISHED] · Version 0.1
      </p>

      <div className="mt-8">
        <LegalDraftNotice />
      </div>

      <p className={p}>
        This Privacy Policy describes how {siteConfig.legalEntityName} (&ldquo;NEXORA,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses and shares information in connection with
        the NEXORA platform. It describes our actual architecture, not generic boilerplate — each
        section below reflects what the system genuinely does.
      </p>

      <h2 className={h2}>1. Information we collect</h2>
      <p className={p}>
        <strong>Account and identity information.</strong> Sign-up and sign-in are handled by our
        identity provider, Clerk — your name, email address, password (hashed by Clerk, never seen
        by us), and organisation memberships are stored there, not in NEXORA&rsquo;s own database.
        We never store a copy of your password.
      </p>
      <p className={p}>
        <strong>Payment information.</strong> Subscription payments are processed by Stripe. We do
        not collect or store your card number, expiry date, or CVC — Stripe handles and stores that
        directly. We store only the subscription status, plan, and Stripe&rsquo;s own
        customer/subscription identifiers needed to know what your organisation is entitled to.
      </p>
      <p className={p}>
        <strong>API keys.</strong> When your organisation creates an API key, we store a one-way
        hash of it and a short, non-secret prefix for identification — the plaintext key is shown to
        you once, at creation, and is never stored or retrievable again.
      </p>
      <p className={p}>
        <strong>Usage and audit events.</strong> We log events describing what your organisation
        does within the Service — for example, that a scan completed, or an API key was created —
        including a timestamp, the organisation and actor involved, and an outcome. This powers
        billing/usage limits, the Usage and Analytics views in Console, and security auditing. We do
        not log the content of what you submit to a product (for example, the log sample you paste
        into Sentinel) as part of this audit trail — only that the action occurred.
      </p>
      <p className={p}>
        <strong>Content you submit to a product.</strong> Some products (for example, Sentinel and
        CSPM) accept data you paste in directly — log samples, resource descriptions — to analyse on
        request. Handling of that content is described on each product&rsquo;s own page;
        [TODO(launch): confirm and state each product&rsquo;s retention period for submitted content
        here once decided].
      </p>

      <h2 className={h2}>2. How we use information</h2>
      <ul className={ul}>
        <li>To provide, maintain and secure the Service;</li>
        <li>To authenticate requests and enforce your organisation&rsquo;s plan limits;</li>
        <li>To process payments and manage subscriptions;</li>
        <li>To respond to support requests sent to {siteConfig.contactEmail};</li>
        <li>To detect, investigate and prevent abuse, fraud, or security incidents;</li>
        <li>To comply with legal obligations.</li>
      </ul>
      <p className={p}>
        We do not sell your personal information, and we do not use content you submit to a product
        to train any model.
      </p>

      <h2 className={h2}>3. Who we share information with</h2>
      <p className={p}>
        We share information with the following categories of service providers (
        &ldquo;subprocessors&rdquo;), each acting under its own terms, solely to operate the
        Service:
      </p>
      <ul className={ul}>
        <li>
          <strong>Clerk</strong> — identity, authentication and organisation membership;
        </li>
        <li>
          <strong>Stripe</strong> — payment processing and subscription billing;
        </li>
        <li>
          <strong>Oracle Cloud Infrastructure</strong> — hosts the application and its Postgres
          database (API key hashes, audit events and subscription state) on servers in Frankfurt,
          Germany;
        </li>
        <li>
          <strong>The AI provider configured for Gateway</strong> — when you use Gateway, your
          request is forwarded to whichever upstream model provider Gateway is configured with, so
          that provider processes the content of that specific request under its own terms.
        </li>
      </ul>
      <p className={p}>
        We do not share your information with third parties for their own marketing purposes.
      </p>

      <h2 className={h2}>4. Data retention</h2>
      <p className={p}>
        We retain account and audit data for as long as your organisation&rsquo;s account is active,
        and for a limited period afterward as needed for legal, tax, or dispute-resolution purposes.
        Our database is backed up nightly (backups kept for 14 days) and the whole server weekly
        (kept for 27 days), so data you delete can remain in backups for up to 27 days before it is
        overwritten. [TODO(launch): specific retention periods per data category not yet decided.]
      </p>

      <h2 className={h2}>5. Cookies</h2>
      <p className={p}>
        We use cookies required for authentication (set by Clerk) and, where used, essential session
        state. We do not currently use analytics, third-party advertising, or cross-site tracking
        cookies.
        {/* Must change if analytics or marketing scripts are ever added to any app. */}
      </p>

      <h2 className={h2}>6. Your rights</h2>
      <p className={p}>
        Depending on your location, you may have rights to access, correct, delete, or export your
        personal information, and to object to or restrict certain processing. To exercise any of
        these rights, contact {siteConfig.legalEmail}. [TODO(launch): this section needs
        jurisdiction-specific detail — e.g. GDPR/UK GDPR and CCPA/CPRA rights and response timelines
        — once NEXORA&rsquo;s operating jurisdictions and user base are known.]
      </p>

      <h2 className={h2}>7. Security</h2>
      <p className={p}>
        See our{" "}
        <a href="/legal/security" className="text-primary hover:underline">
          Security Statement
        </a>{" "}
        for the concrete practices in place. No method of transmission or storage is completely
        secure, and we cannot guarantee absolute security.
      </p>

      <h2 className={h2}>8. Children&rsquo;s privacy</h2>
      <p className={p}>
        The Service is not directed at children and is not intended for use by anyone under the age
        of 16. We do not knowingly collect personal information from children.
      </p>

      <h2 className={h2}>9. Changes to this policy</h2>
      <p className={p}>
        We may update this Privacy Policy from time to time. Material changes will be notified
        through the Service or by email before taking effect.
      </p>

      <h2 className={h2}>10. Contact</h2>
      <p className={p}>
        Questions about this policy can be sent to {siteConfig.legalEmail}. Registered address:{" "}
        {siteConfig.legalAddress}.
      </p>
    </div>
  );
}
