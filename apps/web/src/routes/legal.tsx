import { PUBLIC_BRAND } from "../brand.js";
import { AppShell } from "../components/app-shell.js";
import { PageHeader } from "../components/ui.js";

export function PrivacyRoute() {
  return (
    <AppShell>
      <article className="legal-page page-band">
        <PageHeader title="Privacy Policy"><p>Effective July 24, 2026</p></PageHeader>
        <p className="legal-identity">
          Fullwell is a product operated by Sous Chef Studio, Inc. In this policy, “Fullwell”
          refers to the service operated by Sous Chef Studio, Inc.
        </p>
        <section><h2>The short version</h2><p>Fullwell stores account and household information to provide a private, collaborative food journal. Household journal content stays private unless a member deliberately publishes a collection snapshot.</p></section>
        <section><h2>What Fullwell stores</h2><p>We store your display name, sign-in identifiers, household memberships, connected agent permissions, and operational security records. Household journals may contain food names, recipe links, selected preparation notes, meal proposals, proposer and withdrawal history, confirmed time zone, compatibility caveats, and the household's explicit allergy and food-sensitivity answer. Do not include names, diagnoses, severity, or medical narratives in meal-planning constraints.</p><p>We do not ask agents or browsers to store your Fullwell password because Fullwell does not use service-specific passwords.</p></section>
        <section><h2>Meal planning and recipe research</h2><p>Connected household members can see the shared meal-planning constraint profile, weekly reviews, proposals, attribution, caveats, and withdrawals. Meal-planning data is excluded from public collection snapshots. Fullwell does not promise that a recipe is allergy-safe.</p><p>Codex or Claude recommends meals under your direction. Internet recipe research happens only after you approve it in the agent host, and the agent asks separately before sending allergy or sensitivity terms to a search provider for that search.</p></section>
        <section><h2>Private recipe boards and weekly tasks</h2><p>Codex or Claude may create a bounded private recipe board under the Codex home on your computer. Recipe images load directly from their named source hosts, which receive ordinary network metadata and may receive existing site state. Later board creation removes expired or excess generated boards; uninstalling does not guarantee immediate deletion.</p><p>Any optional weekly meal-planning task belongs to Codex or Claude, not Fullwell. Fullwell stores no schedule, task receipt, calendar event, or task prompt. The task remains in its host until you pause or remove it there.</p></section>
        <section><h2>WhatsApp restocking</h2><p>If you link WhatsApp, Meta carries your request and Fullwell's reply. Fullwell briefly stores encrypted message text and bounded delivery state so your Mac can receive the task. Product reasoning and approved-retailer cart control happen locally through Codex or Claude; the server does not receive the selected product, store, cart quantity, or browser session.</p><p>You can revoke the connection from Account. Link challenges expire after ten minutes, encrypted transport records expire within seven days, and disconnecting the runner removes its local snapshot and action receipts.</p></section>
        <section><h2>Public collection links</h2><p>A collection link shows only the snapshot fields chosen by its publisher. It does not reveal household membership, order identifiers, private evidence, purchase dates, private notes, or the rest of a household. Anyone with an active link can view that snapshot until it expires or is revoked, so share links thoughtfully.</p></section>
        <section><h2>Service providers and location</h2><p>Fullwell uses DigitalOcean for application hosting and durable journal storage, Neon for operational PostgreSQL data, Backblaze for encrypted off-site backups, Resend for sign-in and notices, Apple when you choose Continue with Apple, and Meta when you enable WhatsApp restocking. Codex or Claude, recipe search and image hosts you approve, and an approved retailer process only the work and permissions you choose in those services.</p></section>
        <section><h2>Control and retention</h2><p>You may export household data you can access, revoke agent access, choose whether a search may disclose constraint terms, remove local recipe boards, pause or remove host-native weekly tasks, leave households, and request account deletion. Security and household audit records may retain a pseudonymous former-member label so remaining members can understand changes. Backup retention and deletion timing follow the published production schedule.</p></section>
        <section><h2>Contact</h2><p>Privacy questions or requests can be sent to <a href={`mailto:${PUBLIC_BRAND.privacyEmail}`}>{PUBLIC_BRAND.privacyEmail}</a>. Product support is available at <a href={`mailto:${PUBLIC_BRAND.supportEmail}`}>{PUBLIC_BRAND.supportEmail}</a>.</p></section>
      </article>
    </AppShell>
  );
}

export function TermsRoute() {
  return (
    <AppShell>
      <article className="legal-page page-band">
        <PageHeader title="Terms of Service"><p>Effective July 15, 2026</p></PageHeader>
        <p className="legal-identity">
          Fullwell is a product operated by Sous Chef Studio, Inc. In these terms, “Fullwell”
          refers to the service operated by Sous Chef Studio, Inc.
        </p>
        <section><h2>Using Fullwell</h2><p>You may use Fullwell to maintain food journals for households you are authorized to access. Each person must use an individual cloud account for hosted features. Do not share sign-in links, impersonate another member, probe private collections, or use the service unlawfully.</p></section>
        <section><h2>Your content and permissions</h2><p>You retain rights in content you provide. You give Fullwell permission to store, process, back up, and display it only as needed to operate the service. A household owner controls membership; a collection publisher controls the intentionally shared snapshot.</p></section>
        <section><h2>Agent-assisted records</h2><p>Codex and Claude may help collect evidence and propose journal changes. Review important results. Fullwell is an organizational tool, not medical, dietary, financial, or professional advice.</p></section>
        <section><h2>Availability and changes</h2><p>We work to protect and restore household journals, but no online service is perfectly available. Material changes to these terms will be communicated before they apply where required.</p></section>
        <section><h2>Ending use</h2><p>You may revoke agent access, export available household data, leave eligible households, or request account deletion. Fullwell may suspend abusive access while preserving other household members’ legitimate records and rights.</p></section>
        <section><h2>Contact</h2><p>Questions can be sent to <a href={`mailto:${PUBLIC_BRAND.supportEmail}`}>{PUBLIC_BRAND.supportEmail}</a>.</p></section>
      </article>
    </AppShell>
  );
}
