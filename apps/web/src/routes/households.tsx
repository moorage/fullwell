import { ArrowRight, Plus, Users } from "lucide-react";
import { AppShell } from "../components/app-shell.js";
import { Button, Field, HiddenFormFields, PageHeader, TextInput } from "../components/ui.js";
import { useWebContext } from "../context.js";

export function HouseholdsRoute() {
  const { households } = useWebContext();
  return (
    <AppShell context="workspace" active="households">
      <section className="workspace-page page-band">
        <PageHeader title="Your households">
          <p>Choose a household to review its people, collections, and journal summary.</p>
        </PageHeader>
        <div className="household-list">
          {households.map((household) => (
            <a className="household-row" href={`/households/${household.id}`} key={household.id}>
              <div className="household-row__mark" aria-hidden="true"><Users size={23} /></div>
              <div>
                <h2>{household.name}</h2>
                <p>{household.members} members · {household.role}</p>
              </div>
              <dl>
                <div><dt>Recipes</dt><dd>{household.recipes}</dd></div>
                <div><dt>Groceries</dt><dd>{household.groceries}</dd></div>
              </dl>
              <span>{household.updatedLabel}</span>
              <ArrowRight aria-hidden="true" size={19} />
            </a>
          ))}
        </div>
        <details className="create-disclosure">
          <summary><Plus aria-hidden="true" size={18} /> Create a household</summary>
          <form action="/households" method="post" className="inline-create-form">
            <HiddenFormFields idempotencyKey="create-household-fixture" />
            <Field label="Household name" hint="Use a short name your family will recognize.">
              <TextInput name="name" required maxLength={80} />
            </Field>
            <Button type="submit">Create household</Button>
          </form>
        </details>
      </section>
    </AppShell>
  );
}
