# Public Fullwell Brand and Company Identity

## Purpose / Big Picture

Make Fullwell's logged-out website immediately understandable to people and automated reviewers without changing the product's established visual language. The initial server-rendered HTML must plainly establish that Fullwell is a household assistant, WhatsApp is an optional Fullwell channel, Sous Chef Studio, Inc. owns and operates the product, and `fullwell.ai` is an official alias for the sole application origin at `fullwell.souschefstudio.com`.

The result should help a third-party reviewer verify the display name `Fullwell` from the public site while improving ordinary visitor comprehension. It must not imply that Fullwell is a separate corporation or that WhatsApp or Meta sponsors, owns, or partners with Fullwell.

## Progress

- [x] 2026-07-27T06:55Z: Confirmed the existing SSR, routing, legal, navigation, and metadata boundaries; verified `fullwell.ai` and `www.fullwell.ai` return permanent 301 redirects to the canonical production origin.
- [x] 2026-07-27T07:31Z: Milestone 1 - added the focused public identity routes, homepage sections, navigation/footer disclosure, legal identity, and production contacts.
- [x] 2026-07-27T07:31Z: Milestone 2 - added route metadata, canonical links, Open Graph fields, a PNG social preview asset, and valid provider-linked JSON-LD.
- [x] 2026-07-27T07:46Z: Milestone 3 - added and passed unit, server-rendering, crawler, placeholder, responsive, accessibility, no-JavaScript, social-image, and broken-link verification across the four WebKit projects.
- [ ] Milestone 4 - update product guidance and delivery records, run complete gates, deploy, and verify the logged-out production responses.

## Surprises & Discoveries

- 2026-07-27: The homepage is the existing `/install` React route and already server-renders through `apps/server/src/http/web.ts`; no new marketing application or client-only data path is needed.
- 2026-07-27: The architecture intentionally binds browser sessions, passkeys, Apple callbacks, OAuth, MCP, and absolute application links to `fullwell.souschefstudio.com`. Both `fullwell.ai` aliases already terminate HTTPS and return path-preserving permanent redirects, so canonical metadata must use the final application origin rather than a redirecting alias.
- 2026-07-27: `docs/legal/privacy.md` and `docs/legal/terms.md` already identify `support@fullwell.app` and `privacy@fullwell.app` as production contacts. The rendered install and Terms routes alone still expose `support@fullwell.example`.
- 2026-07-27: The current wordmark is accessible as `Fullwell`, but its decorative literal `F` immediately precedes the visible word and can be perceived as `FFullwell`.
- 2026-07-27: The feature-critic pass found that the original milestone list omitted the normative legal Markdown, allowed public identity facts to drift between content and metadata, and proposed an SVG Open Graph image that common social-review crawlers may not render reliably.
- 2026-07-27: The first browser run exposed only two ambiguous locator assertions caused by legitimate repeated footer/body links; exact accessible names fixed the test without changing the UI. The complete rerun passed 140 checks with 16 intentional project skips.
- 2026-07-27: The full lint gate rejected direct `JSON.parse` use in the E2E structured-data assertion. Parsing the JSON-LD through a narrow Zod schema restored boundary type safety.
- 2026-07-27: The repository screencast helper cannot capture on this macOS host because Homebrew FFmpeg 8.0.1 has no `x11grab` input. It exited 234 without creating an MP4; full-page desktop, iPhone, 320-pixel, and no-JavaScript screenshots remain the visible evidence.

## Decision Log

- 2026-07-27: Keep `https://fullwell.souschefstudio.com/` canonical. This matches the sole-origin architecture and the final URL returned by both official brand aliases.
- 2026-07-27: Use `support@fullwell.app` and retain `privacy@fullwell.app` because the repository's current production legal notices already designate them for those purposes. Do not add any unverified contact.
- 2026-07-27: Preserve the existing paper, leaf, serif, spacing, and open-section system. This is a focused content and identity correction, so the existing-app exception to concept generation applies and no redesign mockup is needed.
- 2026-07-27: Replace the decorative `F` stamp with a decorative household mark while retaining the visible `Fullwell` text and accessible link name.
- 2026-07-27: Represent Sous Chef Studio, Inc. as a Schema.org `Organization` and Fullwell as a `WebApplication` whose provider is that organization. Do not add ratings, pricing, awards, customer counts, partnership claims, or unsupported legal claims.
- 2026-07-27: Keep confirmed names, URLs, and contact addresses in one typed public-brand module shared by visible routes, the shell, and SSR metadata.
- 2026-07-27: Publish a 1200-by-630 PNG Open Graph image generated from a reviewed local vector source. Do not rely on SVG support in third-party preview crawlers.
- 2026-07-27: The doc-drift review requires the two product specs, legal notices, changelog, implementation log, generated repository map, and this plan. No application boundary, authorization, reliability, security, or quality-score change occurred, so Architecture, Security, Reliability, and score values remain unchanged.

## Context and Orientation

`apps/web/src/routes/install.tsx` is both the homepage and installation flow. It owns the current hero and install steps. `apps/web/src/components/app-shell.tsx` owns the visible wordmark, public navigation, and shared footer. `apps/web/src/routes/legal.tsx` owns the rendered Privacy and Terms pages. New static identity routes belong beside these files and are selected by `apps/web/src/route.ts`, `apps/web/src/app.tsx`, and `apps/web/src/types.ts`.

`apps/web/src/server.tsx` maps routes to SSR titles and returns the rendered React body. `apps/server/src/http/web.ts` wraps that body in the initial HTML document and therefore owns canonical, description, Open Graph, and JSON-LD elements. Metadata must be derived from a fixed route-owned description and the configured `WebRenderContext.canonicalUrl`; it must never trust a request host or query parameter. Public identity pages remain indexable. Collection, invitation, household, and authenticated routes retain their existing `noindex` behavior.

The existing Vite build copies `apps/web/public/` into `apps/web/dist/`. A reviewed vector source and crawler-compatible 1200-by-630 PNG social preview can live under `apps/web/public/assets/`, which is then served by the existing immutable `/assets/` static boundary without adding another server route.

The relevant normative guidance is `docs/product-specs/household-food-journal-client.md` section 10 for public installation and handoff UX and `docs/product-specs/household-food-journal-server.md` sections 13.2, 21, and 23 for public routes, accessibility, and the sole canonical application origin.

### Framing Notes

#### Expert panel

- Brand and review-system specialist - ensure the product, operator, domains, and WhatsApp relationship are explicit in crawlable text.
- UX and accessibility specialist - preserve Fullwell's hierarchy, prevent corporate attribution from overpowering the product, and keep the content usable on mobile and without JavaScript.
- Staff web engineer - keep routing and metadata deterministic across React SSR and the Fastify HTML shell.
- Privacy and legal reviewer - correct operator/contact identity without rewriting substantive policies or inventing claims.
- Reliability and operations engineer - preserve the sole-origin boundary, permanent alias redirects, rollback, and deployed-crawler evidence.

#### What problem are we actually solving?

The current site describes a narrow food journal and does not supply enough public, machine-readable evidence to connect the Fullwell product name, household-assistant function, optional WhatsApp channel, corporate operator, and official domains. The change makes that relationship unambiguous in visible SSR content and standards-based metadata.

#### Roundtable highlights

- Brand/review: repeat the exact relationship in the hero, About, verification page, footer, title, description, and structured data without keyword stuffing.
- UX/accessibility: keep Fullwell first and visible; use ordinary headings, lists, and links rather than hidden accordions or client-only content.
- Engineering: create one fixed metadata model and escape every HTML/attribute/script context at the server boundary.
- Privacy/legal: identify Sous Chef Studio, Inc. as operator and contracting company while leaving substantive rights, retention, and liability text unchanged.
- Reliability: canonicalize to the final application origin; prove both alias redirects, all logged-out routes, and initial HTML after deployment.

#### Key tensions

- `fullwell.ai` is the preferred brand domain, but making a redirecting alias canonical would conflict with the sole-origin application and create a canonical that does not serve content.
- The site must be explicit enough for automated review without presenting Meta or WhatsApp as a partner or overstating current outbound-channel availability.
- The required ownership details should be repeated for reviewability while remaining subordinate to the Fullwell product in the visual hierarchy.

#### Synthesis for decomposition

- Put factual, crawlable identity in SSR before adding metadata.
- Keep metadata route-owned, canonical-origin-derived, escaped, and covered by HTTP tests.
- Audit production-facing source and built artifacts separately from test-only `.example` fixtures.
- Treat live deployment, alias redirects, initial HTML, JSON-LD parsing, and mobile/desktop screenshots as acceptance evidence.

#### Feature-critic gate

- Must fix before implementation: include the normative legal Markdown in the contact/operator correction; centralize factual identity values; use a raster Open Graph image; define canonical behavior per public route; and prove initial HTML rather than hydrated DOM alone.
- Should fix during implementation: make the support link directly usable, keep `/about` and `/company` indexable, verify the social image itself returns 200, and ensure private routes do not accidentally gain public canonical or structured-data output.
- Monitor after deployment: whether Meta refreshes its cached public evidence and whether `support@fullwell.app` and `privacy@fullwell.app` are operationally monitored cannot be proven from repository source alone.

## Milestones

### Milestone 1 - Public identity and legal content

Files:

- `apps/web/src/brand.ts`
- `apps/web/src/routes/install.tsx`
- `apps/web/src/routes/company.tsx`
- `apps/web/src/routes/legal.tsx`
- `apps/web/src/components/app-shell.tsx`
- `apps/web/src/route.ts`
- `apps/web/src/app.tsx`
- `apps/web/src/types.ts`
- `apps/web/src/styles.css`
- `docs/legal/privacy.md`
- `docs/legal/terms.md`

Tasks:

1. Replace the homepage hero with the requested Fullwell household-assistant positioning, visible `Fullwell by Sous Chef Studio`, and subordinate operator attribution.
2. Add an indexable `#whatsapp` section with the four examples and an explicit optional-channel statement.
3. Add a homepage company disclosure with the confirmed operator, product, official domains, support address, and retained privacy address, with factual values read from one typed public-brand module.
4. Add `/about` and `/company` routes whose initial HTML plainly states the product/company/domain/WhatsApp relationship.
5. Add About, WhatsApp, Privacy, Terms, and Support links plus the 2026 corporate notice to the shared footer; add focused public-navigation links where they fit.
6. Remove the visible duplicate-F risk while preserving the Fullwell wordmark and accessible name.
7. Replace public `.example` support addresses and add the operator identity to both rendered and normative Privacy and Terms content without changing substantive policy.

Verification:

- `npm test --workspace @hfj/web -- --run src/test/route.test.ts src/test/app.test.tsx`
- `npm run typecheck --workspace @hfj/web`

### Milestone 2 - Metadata and structured identity

Files:

- `apps/web/src/server.tsx`
- `apps/server/src/http/web.ts`
- `apps/web/public/assets/fullwell-social-card.svg`
- `apps/web/public/assets/fullwell-social-card.png`
- `apps/web/src/test/app.test.tsx`
- `apps/server/src/http/app.test.ts`

Tasks:

1. Extend the fixed SSR route metadata with title, description, canonical path, Open Graph values, and optional structured data.
2. Render one canonical link per indexable public page using the configured application origin and route path, never a request host. Do not add public canonical or structured-data output to authenticated or token-bearing pages.
3. Add the required homepage title/description and Fullwell Open Graph fields.
4. Add valid JSON-LD for Sous Chef Studio, Inc. and Fullwell as a household-assistant web application with a provider relationship.
5. Serve a restrained Fullwell social preview PNG from the existing immutable asset boundary and retain its reviewed vector source.
6. Escape title, description, URL, and JSON-LD contexts and prevent `<` from terminating the structured-data script.

Verification:

- `npm test --workspace @hfj/web -- --run src/test/app.test.tsx`
- `npm test --workspace @hfj/server -- --run src/http/app.test.ts`
- `npm run build --workspace @hfj/web`

### Milestone 3 - Crawler, responsive, accessibility, and placeholder acceptance

Files:

- `tests/e2e/web.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `apps/web/src/test/app.test.tsx`
- `apps/server/src/http/app.test.ts`

Tasks:

1. Assert the logged-out initial HTML for `/`, `/about`, and `/company` includes Fullwell, household assistant, WhatsApp, and Sous Chef Studio, Inc.
2. Parse the homepage JSON-LD and assert the organization, application, URL, and provider relationship.
3. Verify navigation/footer links and the Open Graph PNG resolve, core public routes return successful HTML, and private routes keep their existing authorization behavior.
4. Exercise desktop, mobile, reduced-motion, and no-JavaScript layouts; verify the company attribution appears in the initial viewport or immediate hero continuation.
5. Search production-facing source and built artifacts for placeholder email addresses, `.example` email domains, lorem ipsum, and unreviewed staging URLs.
6. Capture desktop and mobile screenshots. Attempt `npm run capture:screencast -- --output artifacts/screencasts/fullwell-public-brand-identity.mp4` for visible evidence; if the existing macOS FFmpeg limitation recurs, record the exact failure and retain screenshot/browser assertions.

Verification:

- `npm run test:e2e`
- `npm run test:accessibility`
- `rg -n -i '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.example|lorem ipsum' apps/web/src apps/web/dist`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Milestone 4 - Documentation, complete gates, and deployment

Files:

- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `docs/exec-plans/active/2026-07-27-public-brand-company-identity.md`

Tasks:

1. Record the public product/operator/domain/WhatsApp identity and new routes in both product specs and the changelog.
2. Review the final diff for architecture and legal drift; the sole application origin and authorization model must remain unchanged.
3. Run all repository, docs, and ExecPlan gates.
4. Build a Linux/amd64 OCI image from the exact reviewed source, deploy it through the existing DigitalOcean systemd/Compose boundary, and retain the previous image and deploy environment as rollback.
5. Verify `fullwell.ai` and `www.fullwell.ai` still return permanent path-preserving redirects, all public routes return 200 while logged out, the initial homepage HTML contains the four required identity strings, JSON-LD parses, metadata is correct, and public links are unbroken.

Verification:

- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `STAGING_BASE_URL=https://fullwell.souschefstudio.com npm run test:deploy-smoke -- staging`
- `STAGING_BASE_URL=https://fullwell.souschefstudio.com npm run test:mcp-smoke -- staging`
- `curl -fsSI https://fullwell.ai/`
- `curl -fsSI https://www.fullwell.ai/`
- `curl -fsS https://fullwell.souschefstudio.com/`
- `curl -fsS https://fullwell.souschefstudio.com/about`
- `curl -fsS https://fullwell.souschefstudio.com/company`

## Acceptance / Verification

Run `npm run test:e2e`, `npm run verify`, `npm run verify:docs`, and `npm run verify:execplan` as the final local acceptance commands, followed by the deployed smoke and live `curl` checks from Milestone 4.

- The homepage visibly renders `Fullwell by Sous Chef Studio`, the requested household-assistant H1 and supporting paragraph, and the operator attribution without requiring JavaScript, authentication, cookies, or interaction.
- The homepage `#whatsapp` section clearly describes WhatsApp as an optional Fullwell channel and includes the four supplied example requests without implying partnership.
- `/about` and `/company` return indexable 200 HTML and directly identify Fullwell, Sous Chef Studio, Inc., both official Fullwell domains, support contact, and WhatsApp functionality.
- The header visibly reads `Fullwell` once; its decorative mark does not create `FFullwell` visually or accessibly.
- The footer contains the operator sentence, complete navigation, support link, and exact 2026 copyright notice.
- Privacy and Terms identify Sous Chef Studio, Inc. as operator and contain no placeholder contacts.
- The root title is `Fullwell Household Assistant | By Sous Chef Studio`; the required description, Open Graph fields, canonical link, social image, and valid JSON-LD appear in initial HTML.
- Exactly one canonical link points to the final production application origin for each indexable page. `fullwell.ai` remains a visible official domain and a permanent redirect, not an application origin.
- Production-facing source and built public artifacts contain no `.example` email addresses, fake companies, lorem ipsum, or staging URLs.
- Desktop, mobile, no-JavaScript, accessibility, full repository, deployed HTTP, and redirect checks pass.
- Rollback is changing `HFJ_IMAGE` back to the prior verified image using the preserved deploy environment backup and restarting the existing systemd unit. No database or household data migration is involved.

## Outcomes & Retrospective

Implementation is pending. Record the exact public copy, metadata, structured-data output, screenshot/screencast evidence, deployment image digest, commands run, and any contact-monitoring fact that could not be independently confirmed.
