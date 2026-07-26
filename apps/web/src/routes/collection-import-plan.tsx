import { ArrowLeft } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { Button, Field, HiddenFormFields, PageHeader, Select, StatusNotice } from "../components/ui.js";
import { useWebContext } from "../context.js";

export function CollectionImportPlanRoute({ token }: { token: string }) {
  const { households, publicCollection } = useWebContext();
  const destinations = households.filter(({ role }) => role === "owner" || role === "editor");
  const selected = publicCollection.items.filter((item) => item.selected);
  return (
    <AppShell context="workspace" active="collections">
      <section className="import-plan page-band">
        <a className="back-link" href={`/c/${token}`}><ArrowLeft aria-hidden="true" size={17} /> Back to selection</a>
        <PageHeader title="Review your import">
          <p>{selected.length} selected {selected.length === 1 ? "item" : "items"} will be copied into the household you choose.</p>
        </PageHeader>
        {destinations.length === 0 ? (
          <StatusNotice tone="warning" title="A household with edit access is required">
            <p>Sign in with an editor or owner account, then reopen this collection.</p>
          </StatusNotice>
        ) : (
          <form action={`/c/${token}/import`} method="post" className="stack-form">
            <HiddenFormFields idempotencyKey="confirm-collection-import" />
            {selected.map((item) => <input type="hidden" name="itemIds" value={item.id} key={item.id} />)}
            <Field label="Destination household" hint="Only households where you can add items are shown.">
              <Select name="householdId" defaultValue={destinations[0]?.id} required>
                {destinations.map((household) => <option value={household.id} key={household.id}>{household.name} - {household.role}</option>)}
              </Select>
            </Field>
            <section className="duplicate-section" aria-labelledby="selected-items-heading">
              <h2 id="selected-items-heading">Selected items</h2>
              <div className="management-list">
                {selected.map((item) => (
                  <div className="duplicate-row" key={item.id}>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.source}</small>
                      {item.kind === "delivery_dish"
                        ? <small>{item.restaurantName} · {item.locationLabel}</small>
                        : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <StatusNotice tone="info" title="What importing records">
              <p>Recipes may be marked Saved. Delivery dishes are copied as recommendations, not prior orders, and cannot authorize a reorder. Fullwell records where each copied item came from.</p>
            </StatusNotice>
            <div className="button-row">
              <Button type="submit" disabled={selected.length === 0}>Confirm import</Button>
              <a className="button button--quiet" href={`/c/${token}`}>Cancel</a>
            </div>
          </form>
        )}
      </section>
    </AppShell>
  );
}
