import { AppShell, HouseholdNav } from "../components/app-shell.js";
import { useWebContext } from "../context.js";
import type { MealPlanProposalSummary } from "../types.js";

export function HouseholdMealPlanRoute({ householdId }: { householdId: string }) {
  const { households, mealPlan, security } = useWebContext();
  const household = households.find(({ id }) => id === householdId);
  if (household === undefined || mealPlan === null || mealPlan.householdId !== householdId) {
    return (
      <AppShell context="workspace" active="households">
        <section className="page-band narrow-page">
          <h1>Household not found</h1>
          <p>This household is unavailable or you no longer have access.</p>
          <a className="text-link--arrow" href="/households">Return to your households</a>
        </section>
      </AppShell>
    );
  }

  const actionPrefix = `/households/${householdId}/meal-plan`;
  return (
    <AppShell context="workspace" active="households">
      <section className="page-band meal-plan">
        <HouseholdNav householdId={householdId} active="meal-plan" />
        <header className="meal-plan__header">
          <div>
            <p className="eyebrow">{household.name} · {mealPlan.timeZoneLabel}</p>
            <h1>Meals for {mealPlan.weekLabel}</h1>
            <p className="page-header__intro">Everyone’s suggestions stay visible, including different ideas for the same meal.</p>
          </div>
          <nav className="week-switcher" aria-label="Choose week">
            <a className="button button--quiet" href={`${actionPrefix}?week=${mealPlan.previousWeek}`}>Previous week</a>
            <a className="button button--quiet" href={`${actionPrefix}?week=${mealPlan.nextWeek}`}>Next week</a>
          </nav>
        </header>

        {mealPlan.statusMessage === null ? null : (
          <p className="notice notice--success meal-plan__status" role="status" aria-live="polite" aria-atomic="true" tabIndex={-1}>
            <span aria-hidden="true">✓</span><span>{mealPlan.statusMessage}</span>
          </p>
        )}

        <ConstraintReview
          actionPrefix={actionPrefix}
          csrf={security.csrfToken}
          idempotencyPrefix={security.idempotencyPrefix}
          mealPlan={mealPlan}
        />

        {mealPlan.canEdit ? (
          <section className="meal-add" aria-labelledby="add-meal-heading">
            <div>
              <p className="eyebrow">Add without replacing</p>
              <h2 id="add-meal-heading">Suggest a meal</h2>
              <p>Each idea is added alongside anything already proposed for that date and slot.</p>
            </div>
            <form className="meal-add__form" method="post" action={`${actionPrefix}/proposals`}>
              <input type="hidden" name="csrf" value={security.csrfToken} />
              <input type="hidden" name="idempotencyKey" value={`${security.idempotencyPrefix}-meal-add`} />
              <input type="hidden" name="week" value={mealPlan.weekStart} />
              <input type="hidden" name="constraintRevision" value={mealPlan.constraintRevision ?? ""} />
              <input type="hidden" name="constraintReviewEventId" value={mealPlan.constraintReviewEventId ?? ""} />
              <label className="field">
                <span className="field__label">Date</span>
                <select className="select-input" name="mealDate" required defaultValue={mealPlan.weekStart}>
                  {mealPlan.days.map((day) => <option key={day.date} value={day.date}>{day.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Meal</span>
                <select className="select-input" name="slotKind" required defaultValue="dinner">
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </label>
              <label className="field meal-add__title">
                <span className="field__label">Meal idea</span>
                <input className="text-input" name="title" maxLength={160} required />
              </label>
              <label className="field">
                <span className="field__label">Servings <span className="fine-print">(optional)</span></span>
                <input className="text-input" name="servings" type="number" min={1} max={100} inputMode="numeric" />
              </label>
              <label className="field meal-add__notes">
                <span className="field__label">Notes <span className="fine-print">(optional)</span></span>
                <textarea className="text-input" name="notes" maxLength={500} rows={2} />
              </label>
              <button className="button button--primary" type="submit">Add meal idea</button>
            </form>
          </section>
        ) : (
          <p className="notice notice--info">
            <span aria-hidden="true">ⓘ</span>
            <span>You can view this week, but only household owners and editors can change it.</span>
          </p>
        )}

        {mealPlan.proposalCount === 0 ? <p className="meal-plan__empty">No meals have been proposed yet.</p> : null}
        <div className="meal-week" id="meal-week" tabIndex={-1}>
          {mealPlan.days.map((day) => (
            <section className="meal-day" key={day.date} aria-labelledby={`day-${day.date}`}>
              <header className="meal-day__header">
                <h2 id={`day-${day.date}`}>{day.label}</h2>
                <span>{day.shortLabel}</span>
              </header>
              <div className="meal-day__slots">
                {day.slots.map((slot) => (
                  <section className="meal-slot" key={slot.id} id={slot.id} tabIndex={-1} aria-label={`${day.label} ${slot.label.toLowerCase()}`}>
                    <h3>{slot.label}</h3>
                    {slot.proposals.length === 0 ? <p className="meal-slot__empty">Open</p> : (
                      <div className="meal-slot__proposals">
                        {slot.proposals.map((proposal) => (
                          <ProposalCard
                            key={proposal.id}
                            proposal={proposal}
                            action={`${actionPrefix}/proposals/${encodeURIComponent(proposal.id)}/withdraw`}
                            csrf={security.csrfToken}
                            idempotencyKey={`${security.idempotencyPrefix}-${proposal.id}-withdraw`}
                            week={mealPlan.weekStart}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function ConstraintReview({
  actionPrefix,
  csrf,
  idempotencyPrefix,
  mealPlan,
}: {
  actionPrefix: string;
  csrf: string;
  idempotencyPrefix: string;
  mealPlan: NonNullable<ReturnType<typeof useWebContext>["mealPlan"]>;
}) {
  if (mealPlan.constraintState === "reviewed") {
    return <p className="constraint-state constraint-state--ready" id="constraint-review" tabIndex={-1}><span aria-hidden="true">✓</span> Constraints reviewed for this week</p>;
  }
  if (mealPlan.constraintState === "missing") {
    return (
      <div className="notice notice--warning" id="constraint-review" tabIndex={-1}>
        <span aria-hidden="true">!</span>
        <div>
          <h2>Meal-planning constraints need attention</h2>
          <p>Ask me in Codex or Claude to review allergies and food sensitivities before planning this week.</p>
          <a href="/install?host=codex">Open the Fullwell setup guide</a>
        </div>
      </div>
    );
  }
  return (
    <div className="notice notice--warning" id="constraint-review" tabIndex={-1}>
      <span aria-hidden="true">!</span>
      <div>
        <h2>Review updated household constraints</h2>
        <p>Meal ideas remain visible, but their compatibility must be checked again.</p>
        {mealPlan.canReview && mealPlan.constraintRevision !== null ? (
          <form method="post" action={`${actionPrefix}/review`}>
            <input type="hidden" name="csrf" value={csrf} />
            <input type="hidden" name="idempotencyKey" value={`${idempotencyPrefix}-constraint-review`} />
            <input type="hidden" name="week" value={mealPlan.weekStart} />
            <input type="hidden" name="constraintRevision" value={mealPlan.constraintRevision} />
            <button className="button button--secondary" type="submit">Mark constraints reviewed</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  action,
  csrf,
  idempotencyKey,
  week,
}: {
  proposal: MealPlanProposalSummary;
  action: string;
  csrf: string;
  idempotencyKey: string;
  week: string;
}) {
  return (
    <article className="meal-card">
      <div className="meal-card__heading">
        <h4>{proposal.title}</h4>
        {proposal.needsRecheck ? <span className="meal-card__warning" title="Review required" aria-hidden="true">!</span> : null}
      </div>
      <p className="meal-card__source">
        {proposal.sourceHref === undefined ? proposal.sourceDetail : (
          <a href={proposal.sourceHref} target="_blank" rel="noreferrer">{proposal.sourceDetail}</a>
        )}
      </p>
      <p className="meal-card__meta">Suggested by {proposal.proposedBy}{proposal.servings === null ? "" : ` · Serves ${proposal.servings}`}</p>
      {proposal.notes === null ? null : <p className="meal-card__notes">{proposal.notes}</p>}
      {proposal.needsRecheck ? (
        <p className="meal-card__recheck"><strong>Needs review against the current household constraints</strong><br />{proposal.compatibilityCaveat}</p>
      ) : (
        <p className="meal-card__compatibility">{proposal.compatibilityLabel}. {proposal.compatibilityCaveat}</p>
      )}
      {proposal.canWithdraw ? (
        <form method="post" action={action}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
          <input type="hidden" name="week" value={week} />
          <button className="button button--quiet meal-card__withdraw" type="submit">Withdraw {proposal.title}</button>
        </form>
      ) : null}
    </article>
  );
}
