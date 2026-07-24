import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { BrandMark } from "../components/brand-mark.js";
import { CollectionItem } from "../components/collection-item.js";
import { ShareActions } from "../components/share-actions.js";
import { Button, ButtonLink, HiddenFormFields, PageHeader, StatusNotice } from "../components/ui.js";
import { useWebContext } from "../context.js";
import type { CollectionItem as CollectionItemModel, CollectionState } from "../types.js";

export function CollectionPreviewRoute({ token, state }: { token: string; state: CollectionState }) {
  if (state !== "ready") return <UnavailableCollection state={state} />;
  return <ReadyCollection token={token} />;
}

function UnavailableCollection({ state }: { state: Exclude<CollectionState, "ready"> }) {
  const titles = {
    expired: "This collection has expired",
    revoked: "This collection is no longer shared",
    unavailable: "We could not open this collection",
  };
  return (
    <AppShell>
      <section className="narrow-page page-band">
        <PageHeader title={titles[state]} />
        <StatusNotice tone={state === "unavailable" ? "error" : "warning"} title="Nothing was imported">
          <p>{state === "unavailable" ? "Check the link and try again." : "Ask the person who shared it for a new link."}</p>
        </StatusNotice>
        <ButtonLink href="/install" variant="secondary">Learn about Fullwell</ButtonLink>
      </section>
    </AppShell>
  );
}

function ReadyCollection({ token }: { token: string }) {
  const { publicCollection, canonicalUrl } = useWebContext();
  const initialSelection = useMemo(
    () => new Set(publicCollection.items.filter((item) => item.selected).map((item) => item.id)),
    [],
  );
  const [selected, setSelected] = useState(initialSelection);
  const recipes = publicCollection.items.filter((item) => item.kind === "recipe");
  const snacks = publicCollection.items.filter((item) => item.kind === "snack");

  function changeSelection(itemId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  function selectGroup(ids: readonly string[], checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  return (
    <AppShell>
      <section className="collection-hero page-band">
        <p className="shared-by">Shared by {publicCollection.sharedBy}</p>
        <PageHeader title={publicCollection.title}>
          <p>{publicCollection.description}</p>
          <p className="expiry">{publicCollection.expiresLabel}</p>
        </PageHeader>
        <ShareActions url={new URL(`/c/${token}`, canonicalUrl).toString()} title={publicCollection.title} />
      </section>
      <form action={`/c/${token}/import/plan`} method="post" className="collection-form page-band">
        <HiddenFormFields idempotencyKey="plan-collection-import" />
        <CollectionGroup
          title="Recipes"
          items={recipes}
          selected={selected}
          onChange={changeSelection}
          onGroupChange={selectGroup}
        />
        <CollectionGroup
          title="Snacks"
          items={snacks}
          selected={selected}
          onChange={changeSelection}
          onGroupChange={selectGroup}
        />
        <div className="sticky-action">
          <div>
            <strong>{selected.size} {selected.size === 1 ? "item" : "items"} selected</strong>
            <span>Sign in is required only when you import.</span>
          </div>
          <Button type="submit" disabled={selected.size === 0}>
            Import selected <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </div>
      </form>
      <section className="privacy-band">
        <div>
          <LockKeyhole aria-hidden="true" size={24} />
          <p><strong>Only this published snapshot is visible.</strong> You cannot see the household, purchase history, private notes, or family members. Importing does not add you to the household.</p>
        </div>
        <nav aria-label="Agent installation">
          <a href="/install?host=codex"><BrandMark brand="chatgpt" /> Use with ChatGPT</a>
          <a href="/install?host=claude"><BrandMark brand="claude" /> Use with Claude</a>
        </nav>
      </section>
    </AppShell>
  );
}

type CollectionGroupProps = {
  title: "Recipes" | "Snacks";
  items: readonly CollectionItemModel[];
  selected: ReadonlySet<string>;
  onChange: (itemId: string, checked: boolean) => void;
  onGroupChange: (ids: readonly string[], checked: boolean) => void;
};

function CollectionGroup({ title, items, selected, onChange, onGroupChange }: CollectionGroupProps) {
  const ids = items.map((item) => item.id);
  const allSelected = ids.every((id) => selected.has(id));
  const selectedCount = ids.filter((id) => selected.has(id)).length;
  return (
    <section className="collection-group" aria-labelledby={`${title.toLowerCase()}-heading`}>
      <header className="collection-group__header">
        <div>
          <h2 id={`${title.toLowerCase()}-heading`}>{title}</h2>
          <p aria-live="polite">{selectedCount} of {ids.length} selected</p>
        </div>
        <label className="select-all">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onGroupChange(ids, event.currentTarget.checked)}
          />
          Select all {title.toLowerCase()}
        </label>
      </header>
      <div className="collection-grid">
        {items.map((item) => (
          <CollectionItem
            key={item.id}
            item={item}
            checked={selected.has(item.id)}
            onChange={(checked) => onChange(item.id, checked)}
          />
        ))}
      </div>
    </section>
  );
}
