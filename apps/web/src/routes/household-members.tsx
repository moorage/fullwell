import { Trash2, UserPlus } from "lucide-react";
import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { Button, Field, HiddenFormFields, PageHeader, Select, TextInput } from "../components/ui.js";
import { useWebContext } from "../context.js";
import { NotFoundRoute } from "./not-found.js";

export function HouseholdMembersRoute({ householdId }: { householdId: string }) {
  const { households, members } = useWebContext();
  const household = households.find((candidate) => candidate.id === householdId);
  if (household === undefined) return <NotFoundRoute />;
  return (
    <AppShell context="workspace" active="households">
      <section className="workspace-page page-band">
        <PageHeader title={`People in ${household.name}`}>
          <p>Each person signs in with an individual account. Owners control invitations and roles.</p>
        </PageHeader>
        <HouseholdNav householdId={householdId} active="members" />
        <section className="management-section" aria-labelledby="members-heading">
          <header><h2 id="members-heading">Members</h2><span>{members.length} people</span></header>
          <div className="management-list">
            {members.map((member) => (
              <div className="member-row" key={member.id}>
                <div className="avatar" aria-hidden="true">{member.name.split(" ").map((part) => part[0]).join("")}</div>
                <div><h3>{member.name}{member.isCurrentUser ? " (you)" : ""}</h3><p>{member.detail}</p></div>
                {member.isCurrentUser || household.role !== "owner" ? (
                  <span className="role-label">{member.role}</span>
                ) : (
                  <form action={`/households/${householdId}/members/${member.id}`} method="post" className="member-actions">
                    <HiddenFormFields idempotencyKey={`member-${member.id}`} />
                    <label><span className="visually-hidden">Role for {member.name}</span><Select name="role" defaultValue={member.role}><option value="editor">Editor</option><option value="viewer">Viewer</option></Select></label>
                    <Button type="submit" variant="quiet">Save role</Button>
                    <Button type="submit" name="intent" value="remove" variant="quiet" aria-label={`Remove ${member.name}`} title={`Remove ${member.name}`}><Trash2 aria-hidden="true" size={18} /></Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
        {household.role === "owner" ? <details className="create-disclosure">
          <summary><UserPlus aria-hidden="true" size={18} /> Invite a family member</summary>
          <form action={`/households/${householdId}/invites`} method="post" className="invite-form">
            <HiddenFormFields idempotencyKey="create-invite-fixture" />
            <Field label="Email address (optional)" hint="Leave blank when you plan to send the link by text."><TextInput type="email" name="emailHint" /></Field>
            <Field label="Role"><Select name="role" defaultValue="viewer"><option value="viewer">Viewer — can read and export</option><option value="editor">Editor — can add and change journal content</option></Select></Field>
            <p className="form-explainer">The link expires in 7 days and works once. Opening it does not automatically join the household.</p>
            <Button type="submit"><UserPlus aria-hidden="true" size={18} /> Create invitation</Button>
          </form>
        </details> : null}
      </section>
    </AppShell>
  );
}
