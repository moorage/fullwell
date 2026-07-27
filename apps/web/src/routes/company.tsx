import { PUBLIC_BRAND } from "../brand.js";
import { AppShell } from "../components/app-shell.js";
import { PageHeader } from "../components/ui.js";

function OfficialDomains() {
  return (
    <ul className="identity-domain-list">
      <li>
        <a href={PUBLIC_BRAND.primaryProductDomain}>fullwell.ai</a> is Fullwell&apos;s primary
        product domain and redirects to the service website.
      </li>
      <li>
        <a href={PUBLIC_BRAND.serviceUrl}>fullwell.souschefstudio.com</a> is Fullwell&apos;s
        service website.
      </li>
    </ul>
  );
}

export function AboutRoute() {
  return (
    <AppShell active="about">
      <article className="identity-page page-band narrow-page">
        <p className="eyebrow">About Fullwell</p>
        <PageHeader title="A household assistant for everyday food tasks">
          <p>
            Fullwell is a household assistant developed and operated by Sous Chef Studio, Inc. It
            helps families organize groceries, pantry inventory, recipes, meal history, and related
            household tasks through AI agents and optional channels such as WhatsApp.
          </p>
        </PageHeader>
        <section>
          <h2>Fullwell and Sous Chef Studio</h2>
          <p>
            <strong>Fullwell</strong> is the consumer-facing product and service.{" "}
            <strong>Sous Chef Studio, Inc.</strong> is the company that owns and operates Fullwell.
          </p>
          <OfficialDomains />
        </section>
        <section>
          <h2>Use Fullwell where you already communicate</h2>
          <p>
            Families can use Fullwell through supported AI agents and optionally connect WhatsApp
            for grocery, pantry, meal-planning, and restocking requests. WhatsApp is a communication
            channel for Fullwell; it is not presented as Fullwell&apos;s owner, sponsor, or operator.
          </p>
          <p><a href="/#whatsapp">Learn how Fullwell works with WhatsApp</a>.</p>
        </section>
      </article>
    </AppShell>
  );
}

export function CompanyRoute() {
  return (
    <AppShell active="company">
      <article className="identity-page page-band narrow-page">
        <p className="eyebrow">Company verification</p>
        <PageHeader title="Fullwell company information">
          <p>
            Fullwell is a household-assistant product owned and operated by Sous Chef Studio, Inc.
          </p>
        </PageHeader>
        <dl className="identity-facts">
          <div><dt>Product</dt><dd>Fullwell</dd></div>
          <div><dt>Legal operator</dt><dd>Sous Chef Studio, Inc.</dd></div>
          <div>
            <dt>Official domains</dt>
            <dd><a href={PUBLIC_BRAND.primaryProductDomain}>fullwell.ai</a> and{" "}
              <a href={PUBLIC_BRAND.serviceUrl}>fullwell.souschefstudio.com</a></dd>
          </div>
          <div>
            <dt>Support</dt>
            <dd><a href={`mailto:${PUBLIC_BRAND.supportEmail}`}>{PUBLIC_BRAND.supportEmail}</a></dd>
          </div>
        </dl>
        <section>
          <h2>Product and company relationship</h2>
          <p>
            Fullwell is the household-assistant product and service.{" "}
            <a href={PUBLIC_BRAND.companyUrl}>Sous Chef Studio, Inc.</a> is the company that
            develops, owns, and operates Fullwell.
          </p>
        </section>
        <section>
          <h2>WhatsApp functionality</h2>
          <p>
            A household can optionally connect Fullwell to WhatsApp and send grocery, pantry,
            meal-planning, and restocking requests. Fullwell securely passes approved requests to
            the household&apos;s connected assistant. WhatsApp is an optional communication channel
            for Fullwell.
          </p>
        </section>
        <p><a href="/">Return to Fullwell</a></p>
      </article>
    </AppShell>
  );
}
