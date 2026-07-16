import { Fingerprint, KeyRound, LogOut, Trash2, Users } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { PasskeyEnrollment } from "../components/passkey-actions.js";
import { Button, HiddenFormFields, PageHeader } from "../components/ui.js";
import { useWebContext } from "../context.js";

export function AccountRoute() {
  const { auth, households, security, viewer } = useWebContext();
  return (
    <AppShell context="workspace" active="account">
      <section className="workspace-page page-band">
        <PageHeader title="Account">
          <p>Review your signed-in identity, household access, and connected agent authorization.</p>
        </PageHeader>
        <section className="account-section" aria-labelledby="profile-heading">
          <header><h2 id="profile-heading">Profile</h2></header>
          <div className="account-row">
            <span className="row-icon"><KeyRound aria-hidden="true" /></span>
            <div><h3>{viewer.displayName || "Fullwell member"}</h3><p>Your sign-in identity is managed by the method you used to authenticate.</p></div>
          </div>
        </section>
        {auth.passkeysEnabled ? (
          <section className="account-section" aria-labelledby="passkeys-heading">
            <header><h2 id="passkeys-heading">Passkeys</h2><p>{auth.passkeys.length} enrolled</p></header>
            {auth.passkeys.length === 0 ? <p className="section-empty">No passkeys are enrolled.</p> : (
              <div className="account-list">
                {auth.passkeys.map((passkey) => (
                  <div className="account-row" key={passkey.id}>
                    <span className="row-icon"><Fingerprint aria-hidden="true" /></span>
                    <div>
                      <h3>{passkey.name}</h3>
                      <p>Added {passkey.createdLabel}{passkey.lastUsedLabel === null ? "" : ` · Last used ${passkey.lastUsedLabel}`}</p>
                    </div>
                    <form action={`/auth/passkeys/${encodeURIComponent(passkey.id)}/remove`} method="post">
                      <input type="hidden" name="csrf" value={security.csrfToken} />
                      <Button type="submit" variant="danger"><Trash2 aria-hidden="true" size={17} /> Remove</Button>
                    </form>
                  </div>
                ))}
              </div>
            )}
            <PasskeyEnrollment csrf={security.csrfToken} passkeys={auth.passkeys} />
          </section>
        ) : null}
        <section className="account-section" aria-labelledby="memberships-heading">
          <header><h2 id="memberships-heading">Households</h2><p>{households.length} accessible</p></header>
          <div className="account-list">
            {households.map((household) => (
              <a className="account-row" href={`/households/${household.id}`} key={household.id}>
                <span className="row-icon"><Users aria-hidden="true" /></span>
                <div><h3>{household.name}</h3><p>{household.role}</p></div>
              </a>
            ))}
          </div>
        </section>
        <section className="account-section" aria-labelledby="access-heading">
          <header><h2 id="access-heading">Connected agent access</h2><p>OAuth grants can be revoked from the agent that authorized them.</p></header>
          <a className="text-link" href="/install">Review agent installation</a>
        </section>
        <form action="/auth/sign-out" method="post">
          <HiddenFormFields />
          <Button type="submit" variant="secondary"><LogOut aria-hidden="true" size={18} /> Sign out</Button>
        </form>
      </section>
    </AppShell>
  );
}
