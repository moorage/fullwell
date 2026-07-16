import { CalendarDays, ShieldCheck, UserPlus } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { Button, ButtonLink, HiddenFormFields, PageHeader, StatusNotice } from "../components/ui.js";
import type { InviteState } from "../types.js";
import { useWebContext } from "../context.js";

export function InviteRoute({ token, state }: { token: string; state: InviteState }) {
  const { invite, viewer, households } = useWebContext();
  if (state === "expired" || state === "revoked") {
    return (
      <AppShell>
        <section className="narrow-page page-band">
          <PageHeader title="This invitation is no longer available" />
          <StatusNotice tone="warning" title={state === "expired" ? "The invitation expired" : "The invitation was withdrawn"}>
            <p>Ask an owner of {invite.householdName} to send a new invitation. No household access was added.</p>
          </StatusNotice>
          <ButtonLink href="/install" variant="secondary">Go to Fullwell</ButtonLink>
        </section>
      </AppShell>
    );
  }

  if (state === "joined") {
    return (
      <AppShell>
        <section className="narrow-page page-band">
          <PageHeader title={`You joined ${invite.householdName}`} />
          <StatusNotice tone="success" title="Household ready">
            <p>Your individual account now has editor access. Changes will show who made them.</p>
          </StatusNotice>
          <ButtonLink href={households[0] === undefined ? "/households" : `/households/${households[0].id}`}>Open household</ButtonLink>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="invite-page page-band">
        <PageHeader title={`${invite.inviterName} invited you to ${invite.householdName}`}>
          <p>Review what joining means before you add your account to this household.</p>
        </PageHeader>
        <div className="invite-summary">
          <div className="invite-summary__mark" aria-hidden="true"><UserPlus size={30} /></div>
          <dl>
            <div><dt>Household</dt><dd>{invite.householdName}</dd></div>
            <div><dt>Invited by</dt><dd>{invite.inviterName}</dd></div>
            <div><dt>Your role</dt><dd>{invite.roleLabel}</dd></div>
            <div><dt>Available until</dt><dd>{invite.expiresLabel}</dd></div>
          </dl>
        </div>
        <div className="role-explainer">
          <ShieldCheck aria-hidden="true" size={23} />
          <p><strong>Editors can add journal evidence, update items, and create collections.</strong> They cannot invite or remove family members, change roles, or delete the household.</p>
        </div>
        {state === "authenticated" ? (
          <form action={`/invite/family/${token}/accept`} method="post" className="decision-block">
            <HiddenFormFields idempotencyKey="accept-family-invite" />
            <p>Joining uses your signed-in account, <strong>{viewer.email}</strong>.</p>
            <Button type="submit"><UserPlus aria-hidden="true" size={19} /> Join household</Button>
            <a className="button button--quiet" href="/households">Not now</a>
          </form>
        ) : (
          <div className="decision-block">
            <ButtonLink href={`/sign-in?returnTo=${encodeURIComponent(`/invite/family/${token}`)}`}>
              Sign in to continue
            </ButtonLink>
            <p className="fine-print"><CalendarDays aria-hidden="true" size={16} /> Opening this link does not join the household.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
