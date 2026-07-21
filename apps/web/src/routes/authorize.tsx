import { ArrowLeft, Check } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { Button, PageHeader } from "../components/ui.js";
import { useWebContext } from "../context.js";
import type { OAuthAuthorizationRequest } from "../types.js";

const scopeLabels: Readonly<Record<string, string>> = {
  "journal:read": "Read household recipes, snacks, evidence, and reports",
  "journal:write": "Add evidence and update journal entries",
  "household:manage": "Manage household membership and invitations",
  "collection:share": "Create, publish, and revoke selected collections",
  "journal:export": "Create household exports",
  "runner:messages": "Receive linked restocking requests on this Mac",
};

export function AuthorizeRoute({ authorization }: { authorization?: OAuthAuthorizationRequest | undefined }) {
  const { security } = useWebContext();
  if (authorization === undefined) {
    return (
      <AppShell context="focused">
        <section className="narrow-page page-band">
          <PageHeader title="Authorization request unavailable">
            <p>Return to your agent and start the connection again.</p>
          </PageHeader>
          <a className="button button--quiet" href="/households"><ArrowLeft aria-hidden="true" size={18} /> Back to households</a>
        </section>
      </AppShell>
    );
  }
  const scopes = authorization.scope.split(" ").map((scope) => scopeLabels[scope] ?? "Use an additional Fullwell permission");
  return (
    <AppShell context="focused">
      <section className="narrow-page page-band">
        <PageHeader title={`Let ${authorization.clientName} use your food journal?`}>
          <p>{authorization.clientName} is asking to work with your authorized household journal on your behalf.</p>
        </PageHeader>
        <section className="consent-list" aria-labelledby="consent-heading">
          <h2 id="consent-heading">{authorization.clientName} will be able to</h2>
          <ul className="check-list">
            {scopes.map((scope) => <li key={scope}><Check aria-hidden="true" /> {scope}</li>)}
          </ul>
          <p>You can revoke access from Account at any time.</p>
        </section>
        <form action="/oauth/authorize" method="post" className="button-row">
          <input type="hidden" name="response_type" value={authorization.responseType} />
          <input type="hidden" name="client_id" value={authorization.clientId} />
          <input type="hidden" name="client_name" value={authorization.clientName} />
          <input type="hidden" name="redirect_uri" value={authorization.redirectUri} />
          <input type="hidden" name="scope" value={authorization.scope} />
          <input type="hidden" name="state" value={authorization.state} />
          <input type="hidden" name="code_challenge" value={authorization.codeChallenge} />
          <input type="hidden" name="code_challenge_method" value={authorization.codeChallengeMethod} />
          <input type="hidden" name="resource" value={authorization.resource} />
          <input type="hidden" name="approve" value="true" />
          <input type="hidden" name="csrf_token" value={security.csrfToken} />
          <Button type="submit">Allow {authorization.clientName}</Button>
          <a className="button button--quiet" href="/households"><ArrowLeft aria-hidden="true" size={18} /> Cancel</a>
        </form>
        <p className="fine-print">Fullwell never gives the agent your sign-in credentials. See <a href="/privacy">Privacy</a>.</p>
      </section>
    </AppShell>
  );
}
