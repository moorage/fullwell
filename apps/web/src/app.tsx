import { AccountRoute } from "./routes/account.js";
import { AuthorizeRoute } from "./routes/authorize.js";
import { CollectionImportPlanRoute } from "./routes/collection-import-plan.js";
import { CollectionPreviewRoute } from "./routes/collection-preview.js";
import { HouseholdCollectionsRoute } from "./routes/household-collections.js";
import { HouseholdMembersRoute } from "./routes/household-members.js";
import { HouseholdMealPlanRoute } from "./routes/household-meal-plan.js";
import { HouseholdGroceriesRoute } from "./routes/household-groceries.js";
import { HouseholdRecipesRoute } from "./routes/household-recipes.js";
import { HouseholdTakeoutRoute } from "./routes/household-takeout.js";
import { HouseholdOverviewRoute } from "./routes/household-overview.js";
import { HouseholdsRoute } from "./routes/households.js";
import { GuideDetailRoute, GuidesRoute } from "./routes/guides.js";
import { InstallRoute } from "./routes/install.js";
import { InviteRoute } from "./routes/invite.js";
import { PrivacyRoute, TermsRoute } from "./routes/legal.js";
import { NotFoundRoute } from "./routes/not-found.js";
import { SignInRoute } from "./routes/sign-in.js";
import { resolveWebRoute } from "./route.js";
import { WebContextProvider } from "./context.js";
import type { WebRenderContext } from "./types.js";

export function App({ url, context }: { url: string; context: WebRenderContext }) {
  const route = resolveWebRoute(url);
  const page = (() => {
    switch (route.page) {
      case "install": return <InstallRoute initialHost={route.host} />;
      case "guides": return <GuidesRoute />;
      case "guide-detail": return <GuideDetailRoute slug={route.slug} />;
      case "sign-in": return <SignInRoute emailSent={context.emailSent} returnTo={route.returnTo} />;
      case "authorize": return <AuthorizeRoute authorization={route.authorization} />;
      case "invite": return <InviteRoute token={route.token} state={context.invite.state} />;
      case "collection": return <CollectionPreviewRoute token={route.token} state={context.collectionState} />;
      case "collection-import-plan": return context.collectionState === "ready"
        ? <CollectionImportPlanRoute token={route.token} />
        : <CollectionPreviewRoute token={route.token} state={context.collectionState} />;
      case "households": return <HouseholdsRoute />;
      case "household": return <HouseholdOverviewRoute householdId={route.householdId} />;
      case "meal-plan": return <HouseholdMealPlanRoute householdId={route.householdId} />;
      case "recipes": return <HouseholdRecipesRoute householdId={route.householdId} pageNumber={route.pageNumber} />;
      case "groceries": return <HouseholdGroceriesRoute householdId={route.householdId} pageNumber={route.pageNumber} />;
      case "takeout": return <HouseholdTakeoutRoute householdId={route.householdId} pageNumber={route.pageNumber} />;
      case "members": return <HouseholdMembersRoute householdId={route.householdId} />;
      case "collections": return <HouseholdCollectionsRoute householdId={route.householdId} />;
      case "account": return <AccountRoute />;
      case "privacy": return <PrivacyRoute />;
      case "terms": return <TermsRoute />;
      case "not-found": return <NotFoundRoute />;
    }
  })();
  return <WebContextProvider context={context}>{page}</WebContextProvider>;
}
