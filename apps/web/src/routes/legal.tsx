import { AppShell } from "../components/app-shell.js";
import { PageHeader } from "../components/ui.js";

export function PrivacyRoute() {
  return (
    <AppShell>
      <article className="legal-page page-band">
        <PageHeader title="Privacy Policy"><p>Effective July 15, 2026</p></PageHeader>
        <section><h2>The short version</h2><p>Fullwell stores account and household information to provide a private, collaborative food journal. Household journal content stays private unless a member deliberately publishes a collection snapshot.</p></section>
        <section><h2>What Fullwell stores</h2><p>We store your display name, sign-in identifiers, household memberships, connected agent permissions, and operational security records. Household journals may contain food names, recipe links, selected preparation notes, and evidence that you asked an agent to record.</p><p>We do not ask agents or browsers to store your Fullwell password because Fullwell does not use service-specific passwords.</p></section>
        <section><h2>Public collection links</h2><p>A collection link shows only the snapshot fields chosen by its publisher. It does not reveal household membership, order identifiers, private evidence, purchase dates, private notes, or the rest of a household. Anyone with an active link can view that snapshot until it expires or is revoked, so share links thoughtfully.</p></section>
        <section><h2>Service providers and location</h2><p>Fullwell uses DigitalOcean for application hosting and durable journal storage, Neon for operational PostgreSQL data, an email provider for sign-in and notices, and Apple when you choose Continue with Apple. Exact production providers and retention settings are documented before launch.</p></section>
        <section><h2>Control and retention</h2><p>You may export household data you can access, revoke agent access, leave households, and request account deletion. Security and household audit records may retain a pseudonymous former-member label so remaining members can understand changes. Backup retention and deletion timing follow the published production schedule.</p></section>
        <section><h2>Contact</h2><p>Questions or requests can be sent to <a href="mailto:privacy@fullwell.example">privacy@fullwell.example</a>.</p></section>
      </article>
    </AppShell>
  );
}

export function TermsRoute() {
  return (
    <AppShell>
      <article className="legal-page page-band">
        <PageHeader title="Terms of Service"><p>Effective July 15, 2026</p></PageHeader>
        <section><h2>Using Fullwell</h2><p>You may use Fullwell to maintain food journals for households you are authorized to access. Each person must use an individual account. Do not share sign-in links, impersonate another member, probe private collections, or use the service unlawfully.</p></section>
        <section><h2>Your content and permissions</h2><p>You retain rights in content you provide. You give Fullwell permission to store, process, back up, and display it only as needed to operate the service. A household owner controls membership; a collection publisher controls the intentionally shared snapshot.</p></section>
        <section><h2>Agent-assisted records</h2><p>Codex and Claude may help collect evidence and propose journal changes. Review important results. Fullwell is an organizational tool, not medical, dietary, financial, or professional advice.</p></section>
        <section><h2>Availability and changes</h2><p>We work to protect and restore household journals, but no online service is perfectly available. Material changes to these terms will be communicated before they apply where required.</p></section>
        <section><h2>Ending use</h2><p>You may revoke agent access, export available household data, leave eligible households, or request account deletion. Fullwell may suspend abusive access while preserving other household members’ legitimate records and rights.</p></section>
        <section><h2>Contact</h2><p>Questions can be sent to <a href="mailto:support@fullwell.example">support@fullwell.example</a>.</p></section>
      </article>
    </AppShell>
  );
}
