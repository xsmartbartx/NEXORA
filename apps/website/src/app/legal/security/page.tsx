import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { LegalDraftNotice } from "@/components/legal-draft-notice";

export const metadata: Metadata = {
  title: "Security Statement",
  description: "The concrete security practices actually built into the NEXORA platform today.",
};

const h2 = "mt-10 text-xl font-semibold text-foreground";
const p = "mt-3 text-sm leading-relaxed text-foreground/90";

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Legal
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Security Statement</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Draft — Effective date: [NOT YET PUBLISHED] · Version 0.1
      </p>

      <div className="mt-8">
        <LegalDraftNotice />
      </div>

      <p className={p}>
        This page describes NEXORA&rsquo;s actual security practices as built today — not a
        certification, and not a claim of any particular compliance framework. Where a practice
        isn&rsquo;t in place yet, we say so directly rather than imply otherwise.
      </p>

      <h2 className={h2}>Identity and access</h2>
      <p className={p}>
        Authentication is delegated to Clerk rather than built by us — we do not implement our own
        password storage or session handling. Machine access (the API) uses per-organisation API
        keys: only a one-way hash of each key is stored, the plaintext is shown exactly once at
        creation, and keys can be revoked instantly from the Console. Every request — human or
        machine — is scoped to a single organisation; no session or key from one organisation can
        read or act on another&rsquo;s data.
      </p>

      <h2 className={h2}>Tenant isolation</h2>
      <p className={p}>
        Every database query that reads or writes organisation-scoped data is filtered by
        organisation at the query itself, not filtered afterward in application code. This is
        verified with an automated cross-organisation isolation check: two organisations&rsquo;
        usage events, API keys and subscription data are confirmed never to leak into each
        other&rsquo;s queries.
      </p>

      <h2 className={h2}>Payments</h2>
      <p className={p}>
        Card numbers and other payment details never reach our servers — checkout happens on
        Stripe&rsquo;s own hosted page, and we receive only a subscription status and Stripe&rsquo;s
        own reference identifiers back. Incoming billing events are authenticated by verifying
        Stripe&rsquo;s webhook signature before anything is processed; unsigned or incorrectly
        signed requests are rejected outright.
      </p>

      <h2 className={h2}>Audit logging</h2>
      <p className={p}>
        Actions your organisation takes — API key creation and revocation, product usage,
        subscription changes — are recorded with an actor, an organisation, a timestamp and an
        outcome, visible to your organisation in Console&rsquo;s Usage and Analytics views.
      </p>

      <h2 className={h2}>Transport and infrastructure</h2>
      <p className={p}>
        All traffic to the Service is intended to be served over HTTPS/TLS. [TODO(launch): edge/TLS
        termination is not provisioned yet — this platform has not been deployed to production
        infrastructure. This statement should be reviewed and confirmed once it has been.] Database
        encryption at rest depends on the Postgres hosting provider selected; [TODO(launch): name
        the provider and confirm its at-rest encryption once selected].
      </p>

      <h2 className={h2}>What we have not done yet</h2>
      <p className={p}>
        In the interest of not overstating our posture: NEXORA has not undergone an independent
        third-party security audit or penetration test, and does not hold any formal security
        certification (e.g. SOC 2, ISO 27001) at this time. Our approach to date has been to verify
        specific mechanisms — tenant isolation, key hashing, webhook signature verification — with
        targeted, repeatable checks against real infrastructure during development, which is a
        different and lesser thing than an independent audit.
      </p>

      <h2 className={h2}>Reporting a vulnerability</h2>
      <p className={p}>
        If you believe you&rsquo;ve found a security vulnerability in NEXORA, please report it to{" "}
        {siteConfig.securityEmail} rather than disclosing it publicly. We ask that you give us a
        reasonable opportunity to investigate and address a report before any public disclosure, and
        that you do not access or modify data that isn&rsquo;t your own while investigating.
        [TODO(launch): formalise a disclosure/bounty policy and response-time commitment once real
        infrastructure exists to triage against.]
      </p>
    </div>
  );
}
