import { Bot, DoorOpen, Download, Fingerprint, KeyRound, LogOut, Mail, Pencil, Trash2, Unplug, Users } from "lucide-react";
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
          <form className="account-row account-form" action="/account/profile" method="post">
            <span className="row-icon"><Pencil aria-hidden="true" /></span>
            <label><span>Display name</span><input name="display_name" defaultValue={viewer.displayName || "Fullwell member"} maxLength={120} required /></label>
            <input type="hidden" name="csrf" value={security.csrfToken} />
            <Button type="submit" variant="secondary">Update</Button>
          </form>
        </section>
        <section className="account-section" aria-labelledby="methods-heading">
          <header><h2 id="methods-heading">Sign-in methods</h2><p>{auth.methods.length + auth.passkeys.length} available</p></header>
          <div className="account-list">
            {auth.methods.map((method) => (
              <div className="account-row" key={method.provider}>
                <span className="row-icon"><KeyRound aria-hidden="true" /></span>
                <div><h3>{method.label}</h3><p>Use this method to sign in without a Fullwell password.</p></div>
                <form action={`/account/sign-in-methods/${method.provider}/remove`} method="post">
                  <input type="hidden" name="csrf" value={security.csrfToken} />
                  <Button type="submit" variant="danger"><Trash2 aria-hidden="true" size={17} /> Remove</Button>
                </form>
              </div>
            ))}
            {!auth.methods.some((method) => method.provider === "magic_link") ? (
              <form className="account-row account-form" action="/account/sign-in-methods/magic_link/start" method="post">
                <span className="row-icon"><Mail aria-hidden="true" /></span>
                <label><span>Email address</span><input type="email" name="email" autoComplete="email" maxLength={320} required /></label>
                <input type="hidden" name="csrf" value={security.csrfToken} />
                <Button type="submit" variant="secondary">Add email</Button>
              </form>
            ) : null}
            {!auth.methods.some((method) => method.provider === "apple") ? (
              <form className="account-row" action="/account/sign-in-methods/apple/start" method="post">
                <span className="row-icon"><KeyRound aria-hidden="true" /></span>
                <div><h3>Apple</h3><p>Use your Apple account as another sign-in method.</p></div>
                <input type="hidden" name="csrf" value={security.csrfToken} />
                <Button type="submit" variant="secondary">Add Apple</Button>
              </form>
            ) : null}
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
              <div className="account-row" key={household.id}>
                <span className="row-icon"><Users aria-hidden="true" /></span>
                <div><h3><a href={`/households/${household.id}`}>{household.name}</a></h3><p>{household.role}</p></div>
                <form className="confirmation-form" action={`/account/households/${household.id}/leave`} method="post">
                  <input type="hidden" name="csrf" value={security.csrfToken} />
                  <label><span className="sr-only">Type LEAVE to leave {household.name}</span><input name="confirmation" placeholder="Type LEAVE" required /></label>
                  <Button type="submit" variant="danger"><DoorOpen aria-hidden="true" size={17} /> Leave</Button>
                </form>
              </div>
            ))}
          </div>
        </section>
        <section className="account-section" id="exports" aria-labelledby="exports-heading">
          <header><h2 id="exports-heading">Household exports</h2><p>Links expire after 15 minutes</p></header>
          <div className="account-list">
            {households.map((household) => (
              <div className="account-row" key={household.id}>
                <span className="row-icon"><Download aria-hidden="true" /></span>
                <div><h3>{household.name}</h3><p>Readable files or an advanced history bundle.</p></div>
                <form action={`/account/households/${household.id}/exports`} method="post">
                  <input type="hidden" name="csrf" value={security.csrfToken} />
                  <input type="hidden" name="idempotency_key" value={`${security.idempotencyPrefix}-${household.id}-readable-export`} />
                  <input type="hidden" name="format" value="readable_zip" />
                  <Button type="submit" variant="secondary"><Download aria-hidden="true" size={17} /> Download ZIP</Button>
                </form>
              </div>
            ))}
          </div>
          <details><summary>Advanced export</summary><p>A Git bundle preserves the complete change history for technical restore workflows.</p>
            {households.map((household) => (
              <form action={`/account/households/${household.id}/exports`} method="post" key={household.id}>
                <input type="hidden" name="csrf" value={security.csrfToken} />
                <input type="hidden" name="idempotency_key" value={`${security.idempotencyPrefix}-${household.id}-bundle-export`} />
                <input type="hidden" name="format" value="git_bundle" />
                <Button type="submit" variant="secondary"><Download aria-hidden="true" size={17} /> {household.name} history bundle</Button>
              </form>
            ))}
          </details>
        </section>
        <section className="account-section" aria-labelledby="access-heading">
          <header><h2 id="access-heading">Connected agent access</h2><p>{auth.grants.length} active</p></header>
          {auth.grants.length === 0 ? <p className="section-empty">No agents currently have access.</p> : (
            <div className="account-list">
              {auth.grants.map((grant) => (
                <div className="account-row" key={grant.id}>
                  <span className="row-icon"><Bot aria-hidden="true" /></span>
                  <div><h3>{grant.clientName}</h3><p>{grant.scopes.length} permissions</p></div>
                  <form action={`/account/grants/${encodeURIComponent(grant.id)}/revoke`} method="post">
                    <input type="hidden" name="csrf" value={security.csrfToken} />
                    <Button type="submit" variant="danger"><Unplug aria-hidden="true" size={17} /> Revoke</Button>
                  </form>
                </div>
              ))}
            </div>
          )}
          <a className="text-link" href="/install">Review agent installation</a>
        </section>
        <form action="/auth/sign-out" method="post">
          <HiddenFormFields />
          <Button type="submit" variant="secondary"><LogOut aria-hidden="true" size={18} /> Sign out</Button>
        </form>
        <section className="account-section danger-zone" aria-labelledby="delete-heading">
          <header><h2 id="delete-heading">Delete account</h2><p>This revokes every session and connected agent.</p></header>
          <p>You must first transfer or delete any household you solely own. Household history keeps a pseudonymous former-member label.</p>
          <form className="confirmation-form" action="/account/delete" method="post">
            <input type="hidden" name="csrf" value={security.csrfToken} />
            <label><span>Type DELETE to confirm</span><input name="confirmation" autoComplete="off" required /></label>
            <Button type="submit" variant="danger"><Trash2 aria-hidden="true" size={17} /> Delete account</Button>
          </form>
        </section>
      </section>
    </AppShell>
  );
}
