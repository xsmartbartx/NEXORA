import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { LegalDraftNotice } from "@/components/legal-draft-notice";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement governing use of NEXORA's products, accounts and billing.",
};

const h2 = "mt-10 text-xl font-semibold text-foreground";
const h3 = "mt-6 text-base font-semibold text-foreground";
const p = "mt-3 text-sm leading-relaxed text-foreground/90";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Legal
      </span>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Draft — Effective date: [NOT YET PUBLISHED] · Version 0.1
      </p>

      <div className="mt-8">
        <LegalDraftNotice />
      </div>

      <p className={p}>
        These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the websites,
        applications, APIs and other services operated under the NEXORA name (collectively, the
        &ldquo;Service&rdquo;), provided by {siteConfig.legalEntityName} (&ldquo;NEXORA,&rdquo;
        &ldquo;we,&rdquo; &ldquo;us&rdquo;). By creating an account, accessing, or using the
        Service, you agree to be bound by these Terms. If you are agreeing on behalf of an
        organisation, you represent that you have the authority to bind that organisation.
      </p>

      <h2 className={h2}>1. Eligibility</h2>
      <p className={p}>
        You must be at least the age of majority in your jurisdiction to create an account. If you
        are using the Service on behalf of an organisation, that organisation is bound by these
        Terms and both you and the organisation are jointly responsible for compliance.
      </p>

      <h2 className={h2}>2. Accounts and organisations</h2>
      <p className={p}>
        Access to the Service requires an account. Accounts, API keys and billing all belong to an{" "}
        <strong>organisation</strong>, never to an individual person directly — a person may belong
        to more than one organisation and switches between them explicitly. You are responsible for
        maintaining the security of your account credentials and for all activity that occurs under
        your account or organisation, including activity performed with API keys your organisation
        issues. Notify us immediately at {siteConfig.contactEmail} if you suspect unauthorised
        access.
      </p>

      <h2 className={h2}>3. The Service</h2>
      <p className={p}>
        NEXORA is a platform of individually-scoped products. Each product&rsquo;s own page states
        what it actually does today, as distinct from features described as planned or on the
        roadmap — that distinction is part of these Terms, not just marketing copy. Products at the
        &ldquo;beta&rdquo; lifecycle stage may change, be limited, or be discontinued with notice;
        products in earlier stages (Labs) carry no service-level commitment at all.
      </p>
      <p className={p}>
        We do not guarantee that the Service will be uninterrupted, error-free, or available at any
        particular time, except to the extent a separately agreed service-level commitment says
        otherwise for your plan.
      </p>

      <h2 className={h2}>4. Subscriptions, billing and payment</h2>
      <p className={p}>
        Paid plans are billed on a recurring basis through our payment processor, Stripe. By
        subscribing to a paid plan, you authorise us (via Stripe) to charge your payment method on a
        recurring basis until you cancel. Plan names, prices and usage limits in effect at any given
        time are shown in the Console and are subject to change with notice before your next billing
        period.
      </p>
      <p className={p}>
        Usage limits are enforced per organisation per billing period as described for your plan.
        Exceeding a limit may result in the relevant feature being blocked until the next billing
        period or until you upgrade.
      </p>

      <h3 className={h3}>4.1 Cancellation and refunds</h3>
      <p className={p}>
        You may cancel a paid plan at any time from the Console; cancellation takes effect at the
        end of the current billing period unless stated otherwise at the time of cancellation.
      </p>
      <p className={p}>
        <strong>
          [TODO(launch): refund policy not yet decided — this is a business decision, not a
          technical one. Placeholder pending a real answer:]
        </strong>{" "}
        Except where required by applicable law, fees already paid are non-refundable.
      </p>

      <h2 className={h2}>5. Acceptable use</h2>
      <p className={p}>You agree not to, and not to permit others through your account to:</p>
      <ul className={ul}>
        <li>Use the Service to violate any applicable law or third party&rsquo;s rights;</li>
        <li>
          Attempt to gain unauthorised access to the Service, other accounts or organisations, or
          the systems or networks connected to the Service;
        </li>
        <li>
          Interfere with or disrupt the integrity or performance of the Service, including through
          excessive automated requests beyond your plan&rsquo;s rate limits;
        </li>
        <li>Reverse engineer, decompile, or attempt to extract source code from the Service;</li>
        <li>
          Use the Service to build a product that is directly competitive with it, using access
          obtained through the Service itself;
        </li>
        <li>Resell or sublicense access to the Service without our prior written consent.</li>
      </ul>

      <h2 className={h2}>6. API access and rate limits</h2>
      <p className={p}>
        API keys are issued per organisation and must be kept confidential. Requests made with an
        API key are treated as authorised by the organisation that issued it. We may rate-limit or
        throttle API usage to protect the Service&rsquo;s stability, as described in the API
        documentation.
      </p>

      <h2 className={h2}>7. Intellectual property</h2>
      <p className={p}>
        NEXORA and its licensors retain all right, title and interest in the Service, including all
        software, design and content we provide, excluding any content or data you submit. Subject
        to these Terms, we grant you a limited, non-exclusive, non-transferable licence to access
        and use the Service for your own internal business purposes.
      </p>
      <p className={p}>
        You retain ownership of any data, content or configuration you submit to the Service (
        &ldquo;Your Data&rdquo;). You grant us a licence to host, process and transmit Your Data
        solely to provide the Service to you.
      </p>

      <h2 className={h2}>8. Disclaimers</h2>
      <p className={p}>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT
        WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM
        EXTENT PERMITTED BY APPLICABLE LAW. Product pages describe what each product does today;
        outputs of any statistical, rule-based or AI-assisted feature are provided for your review
        and are not guaranteed to be complete, accurate, or suitable for any particular decision.
      </p>

      <h2 className={h2}>9. Limitation of liability</h2>
      <p className={p}>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEXORA WILL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE,
        DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY
        FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID US
        IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
      </p>

      <h2 className={h2}>10. Indemnification</h2>
      <p className={p}>
        You agree to indemnify and hold NEXORA harmless from any claims, damages, or expenses
        (including reasonable legal fees) arising from your violation of these Terms or misuse of
        the Service.
      </p>

      <h2 className={h2}>11. Termination</h2>
      <p className={p}>
        You may stop using the Service and close your account at any time. We may suspend or
        terminate your access to the Service if you materially breach these Terms and do not cure
        the breach within a reasonable time after notice, or immediately if required to prevent harm
        to the Service or other users. Sections of these Terms that by their nature should survive
        termination (including Intellectual Property, Disclaimers, Limitation of Liability, and
        Governing Law) will survive.
      </p>

      <h2 className={h2}>12. Changes to these Terms</h2>
      <p className={p}>
        We may update these Terms from time to time. Material changes will be notified through the
        Service or by email before taking effect. Continued use of the Service after a change takes
        effect constitutes acceptance of the updated Terms.
      </p>

      <h2 className={h2}>13. Governing law</h2>
      <p className={p}>
        These Terms are governed by the laws of {siteConfig.legalJurisdiction}, without regard to
        its conflict-of-laws principles. [TODO(launch): dispute resolution mechanism — arbitration
        clause, venue, and class-action waiver, if any — is a legal decision not yet made.]
      </p>

      <h2 className={h2}>14. Contact</h2>
      <p className={p}>
        Questions about these Terms can be sent to {siteConfig.legalEmail}. Registered address:{" "}
        {siteConfig.legalAddress}.
      </p>
    </div>
  );
}
