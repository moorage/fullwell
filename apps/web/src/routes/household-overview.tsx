import { ArrowUpRight, BookOpen, Coffee, Download, ExternalLink, ShoppingBag, Sparkles } from "lucide-react";
import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { BrandMark } from "../components/brand-mark.js";
import { ButtonLink, PageHeader, StatusNotice } from "../components/ui.js";
import { useWebContext } from "../context.js";
import { NotFoundRoute } from "./not-found.js";

export function HouseholdOverviewRoute({ householdId }: { householdId: string }) {
  const { collections, households } = useWebContext();
  const household = households.find((candidate) => candidate.id === householdId);
  if (household === undefined) return <NotFoundRoute />;
  return (
    <AppShell context="workspace" active="households">
      <section className="workspace-page page-band">
        <PageHeader
          title={household.name}
          action={<span className="role-label">Your role: {household.role}</span>}
        >
          <p>A shared record of the food your household buys, saves, cooks, and likes.</p>
        </PageHeader>
        <HouseholdNav householdId={householdId} active="overview" />
        <StatusNotice tone="info" title="Continue journal work with your agent">
          <p>Ask ChatGPT or Claude to audit purchases, track a recipe, or create a collection. The browser does not edit journal entries.</p>
          <div className="notice-actions">
            <a href="/install?host=codex"><BrandMark brand="chatgpt" /> Use with ChatGPT <ExternalLink aria-hidden="true" size={16} /></a>
            <a href="/install?host=claude"><BrandMark brand="claude" /> Use with Claude <ExternalLink aria-hidden="true" size={16} /></a>
          </div>
        </StatusNotice>
        <section className="journal-summary" aria-labelledby="journal-summary-heading">
          <header><h2 id="journal-summary-heading">Journal at a glance</h2><p>{household.updatedLabel}</p></header>
          <div className="summary-rail">
            <a href={`/households/${householdId}/recipes`}><BookOpen aria-hidden="true" /><strong>{household.recipes}</strong><span>Recipes</span><small>Browse visually</small></a>
            <a href={`/households/${householdId}/groceries`}><Coffee aria-hidden="true" /><strong>{household.groceries}</strong><span>Groceries</span><small>Browse visually</small></a>
            <a href={`/households/${householdId}/takeout`}><ShoppingBag aria-hidden="true" /><strong>{household.takeout}</strong><span>Takeout</span><small>Browse familiar dishes</small></a>
            <div><Sparkles aria-hidden="true" /><strong>{collections.length}</strong><span>Collections</span></div>
          </div>
        </section>
        <div className="page-actions">
          <ButtonLink href="/account#exports" variant="secondary"><Download aria-hidden="true" size={18} /> Export household</ButtonLink>
          <a className="text-link text-link--arrow" href={`/households/${householdId}/collections`}>Review collections <ArrowUpRight aria-hidden="true" size={17} /></a>
        </div>
      </section>
    </AppShell>
  );
}
