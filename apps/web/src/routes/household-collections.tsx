import { Copy, ExternalLink, Link2Off, Plus } from "lucide-react";
import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { Button, ButtonLink, HiddenFormFields, PageHeader } from "../components/ui.js";
import { useWebContext } from "../context.js";
import { NotFoundRoute } from "./not-found.js";

export function HouseholdCollectionsRoute({ householdId }: { householdId: string }) {
  const { collections, households } = useWebContext();
  const household = households.find((candidate) => candidate.id === householdId);
  if (household === undefined) return <NotFoundRoute />;
  return (
    <AppShell context="workspace" active="collections">
      <section className="workspace-page page-band">
        <PageHeader title={`Collections from ${household.name}`}>
          <p>Collections are intentional snapshots. Later journal changes do not alter a link that is already shared.</p>
        </PageHeader>
        <HouseholdNav householdId={householdId} active="collections" />
        <div className="management-list collection-management-list">
          {collections.map((collection) => (
            <article className="collection-row" key={collection.id}>
              <div><span className={`status-label status-label--${collection.status}`}>{collection.status}</span><h2>{collection.title}</h2><p>{collection.itemCount} items · {collection.detail}</p></div>
              <div className="collection-row__actions">
                {collection.status === "published" && collection.publicUrl !== undefined ? (
                  <>
                    <a className="button button--quiet" href={collection.publicUrl}><ExternalLink aria-hidden="true" size={17} /> Preview</a>
                    <Button type="button" variant="quiet"><Copy aria-hidden="true" size={17} /> Copy link</Button>
                    <form action={`/households/${householdId}/collections/${collection.id}/revoke`} method="post">
                      <HiddenFormFields idempotencyKey={`revoke-${collection.id}`} />
                      <Button type="submit" variant="danger"><Link2Off aria-hidden="true" size={17} /> Revoke link</Button>
                    </form>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <section className="agent-callout">
          <div><Plus aria-hidden="true" size={24} /><div><h2>Create a collection with your agent</h2><p>Ask Codex or Claude to find the intended items, review exactly what will be public, and publish a snapshot.</p></div></div>
          <ButtonLink href="/install?host=codex" variant="secondary">Agent instructions</ButtonLink>
        </section>
      </section>
    </AppShell>
  );
}
