import { ArrowLeft, Check } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { Button, HiddenFormFields, PageHeader } from "../components/ui.js";

export function AuthorizeRoute() {
  return (
    <AppShell context="focused">
      <section className="narrow-page page-band">
        <PageHeader title="Let Codex use your food journal?">
          <p>Codex is asking to work with your authorized household journal on your behalf.</p>
        </PageHeader>
        <section className="consent-list" aria-labelledby="consent-heading">
          <h2 id="consent-heading">Codex will be able to</h2>
          <ul className="check-list">
            <li><Check aria-hidden="true" /> Read household recipes, snacks, and reports</li>
            <li><Check aria-hidden="true" /> Add evidence and propose journal changes</li>
            <li><Check aria-hidden="true" /> Create and share selected collections</li>
          </ul>
          <p>Codex cannot manage family members or delete your household. You can revoke access from Account at any time.</p>
        </section>
        <form action="/authorize/decision" method="post" className="button-row">
          <HiddenFormFields />
          <input type="hidden" name="decision" value="allow" />
          <Button type="submit">Allow Codex</Button>
          <a className="button button--quiet" href="/authorize/cancel"><ArrowLeft aria-hidden="true" size={18} /> Cancel</a>
        </form>
        <p className="fine-print">Fullwell never gives the agent your sign-in credentials. See <a href="/privacy">Privacy</a>.</p>
      </section>
    </AppShell>
  );
}
