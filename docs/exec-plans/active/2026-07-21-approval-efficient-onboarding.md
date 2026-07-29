# Approval-Efficient Fullwell Onboarding

## Purpose / Big Picture

Fullwell onboarding must provide value before requiring a cloud account. A fresh installation first asks the person's preferred name, remembers it locally, warmly acknowledges that answer by name, and only then asks whether they already have a Fullwell cloud account. Existing cloud-account holders use the current OAuth and hosted-household path. Everyone else completes grocery-history and recipe onboarding against a durable local guest household without any Fullwell MCP call, can use that local data for direct restocking and recipe recall, and is offered optional cloud backup only after collection. Creating a cloud account remains required for WhatsApp, collection sharing, and multiplayer access. The existing hosted path still uses one membership-authorized snapshot, a local checkpoint, and one final `hfj_commit_onboarding` write.

The final write must also fit real grocery histories. The original 100-item and 500-evidence limits were conservative schema guards chosen alongside the one-megabyte HTTP default before a live audit produced 196 items and 804 evidence records. They are not domain or storage constraints. The confirmed onboarding contract now needs count limits of 10,000 items and 10,000 evidence records while retaining a separate route-specific byte limit, authorization, revision checks, idempotency, and one-commit semantics.

The change is a direct usability iteration on `docs/ideas/backlog/conversational-fullwell-onboarding.md`, promoted when the user reported repeated MCP approvals during real onboarding on 2026-07-21 and explicitly approved the read-draft-commit implementation. It remains high-priority because approval fatigue interrupts the first action that makes Fullwell useful. Browser, Chrome, site sign-in, CAPTCHA, and other source-specific consent remain separate and are never implied by the initial Fullwell read.

The 2026-07-24 identity iteration makes the person's preferred name the first conversational question and remembers it independently of local-versus-cloud household authority. Cloud connection copies that confirmed name into the cloud account display name. A first household receives a possessive default such as `Maya's Household` or `Chris' Household` only when no household exists and no pending household is being joined. Later chat requests can rename the person or household in the active local or cloud authority, stop the exact local WhatsApp runner without deleting its connection, remove the exact host-native weekly meal reminder, and receive context-sensitive invitation or collection examples after successful setup.

The 2026-07-28 conversational iteration uses the returned preferred name in the first cloud-account routing question: `Hey <display_name>, nice to be acquainted. Do you already have a Fullwell cloud account?` Later turns may reuse the name after a conversational gap or meaningful transition, but never in adjacent replies or every message. User-facing onboarding copy calls hosted identity a cloud account whenever it is contrasted with account-free local use.

The 2026-07-27 web iteration exposes that same owner-only, Git-authoritative household rename on the authenticated household overview. An owner can reveal an edit control beside the household title by hovering or focusing the title area, open a dialog whose current name is selected in an autofocus text input, and submit through a CSRF-protected, idempotent, exact-HEAD browser mutation. Touch users see the edit control without hover. A public household-naming guide explains both natural chat requests and the website path without changing editor or viewer authority.

## Progress

- [x] 2026-07-28T23:49Z: Pushed release commits `7fef31b` and `0a8ebcb` for preserved-name conversational cadence and explicit cloud-account wording; deployed checksum-matched Linux/amd64 image `hfj-staging:personalized-icon-0a8ebcb-runtime`; and passed public readiness, deployment/MCP, exact-asset, metadata, visual, operator-health, warning-log, and mounted-volume checks with rollback retained.
- [x] 2026-07-28: Completed Bead `fullwell-gs8.16` across the shared skill, voice contract, cross-host evals, client specification, install guidance, changelog, and implementation log. The package validates 184 eval cases; all 14 eval tests, 53 packaging/lifecycle tests, lint, typecheck, production builds, 424 application tests, and repository/docs/ExecPlan verification pass, with 12 expected database-gated skips.
- [x] Milestone 12 - expose owner household renaming on the web and document chat plus web naming.
- [x] 2026-07-27: Created and claimed Bead `fullwell-46b`, confirmed the existing chat rename tool/eval already covers connected local and cloud authority, and framed the web integration with UX, accessibility, security, reliability, architecture, and eval lenses.
- [x] 2026-07-27: Passed the Milestone 12 failure-oriented feature-critic gate by requiring a keyboard/touch-equivalent reveal, owner-only server authorization, CSRF and exact-HEAD checks, native no-JavaScript form fallback, focus restoration, friendly conflict recovery, and direct public guide coverage for both chat and web paths.
- [x] 2026-07-27: Completed Milestone 12 locally with an owner-only hover/focus/touch title control, autofocus and preselected native dialog, no-JavaScript fallback, exact-HEAD browser mutation through `hfj_update_household_name`, private human-readable failure pages, and the public `/guides/household-name` guide.
- [x] 2026-07-27: Passed 98 web tests, 25 focused server tests, the 14-test agent eval suite, the 142-test applicable WebKit suite with 22 intentional project skips, Browser-plugin guide inspection, production build, and full verification with 420 application tests and 11 expected database skips.
- [x] 2026-07-27: Attempted `artifacts/screencasts/web-household-rename.mp4`; Homebrew FFmpeg 8.0.1 rejected the helper's Linux-only `x11grab` input with exit code 234, so no MP4 was created and the Browser-plugin screenshot plus deterministic WebKit tests remain the visible evidence.
- [x] 2026-07-27: Pushed release commit `1605e3a` and deployed checksum-matched Linux/amd64 image `hfj-staging:household-rename-20260727-1-runtime`. Schema `0008` readiness, deployment and MCP discovery smokes, the public naming guide, anonymous no-mutation rename boundary, mounted-volume canary, exact running image, and operator readiness pass; the prior image and deploy environment retain rollback.
- [x] Milestone 11 - remember name-first identity, synchronize cloud naming, and add conversational local controls and next steps.
- [x] 2026-07-24T05:55Z: Completed Milestone 11 locally with a separate private revisioned profile, deterministic first-household naming, account-scoped cloud display-name updates, Git-authoritative owner household renames with Neon recovery, a fixed-purpose WhatsApp runner stop, exact weekly-reminder removal guidance, and context-gated invitation and collection examples.
- [x] 2026-07-24T05:55Z: Passed the 21-test contract boundary, 50 focused server tests, 43 packaging/lifecycle tests, 14 scheduler/eval tests, 328-test full application suite with 11 expected database skips, 39 applicable WebKit checks with 13 intentional project skips, lint, typecheck, production build, seven-migration up/down/up, all 11 PostgreSQL adapter integrations, and full repository/docs/ExecPlan verification.
- [x] 2026-07-24T05:55Z: Attempted `artifacts/screencasts/name-first-household-controls.mp4`; Homebrew FFmpeg 8.0.1 rejected the helper's Linux-only `x11grab` input with exit code 234, so no MP4 was created and the package/eval/browser evidence remains the acceptance proof.
- [x] 2026-07-24T16:28Z: Published immutable public `@fullwell/fullwell@1.1.12` as npm `latest`; the registry's 28-file SHA-1 and SHA-512 byte-match the prepared tarball, and a clean registry install passes isolated Codex and Claude lifecycles.
- [x] 2026-07-24T17:47Z: Published immutable correction `@fullwell/fullwell@1.1.13` after live Claude rejected the 1.1.12 household-update tool schema. Every local tool now exposes a top-level object input type, Claude's install handoff says `Hi Fullwell.`, the exact greeting has name-first eval coverage, and broken 1.1.12 is deprecated.
- [x] 2026-07-24T17:59Z: Upgraded current Codex and Claude to enabled 1.1.13, verified Claude `fullwell-local` as `Connected` without a tools-fetch failure, and passed the clean downloaded host lifecycles. Deployed the same public greeting in `hfj-staging:claude-greeting-20260724-2-runtime` after upgrading newly vulnerable `@fastify/static` 10.1.0 to 10.1.2; production audit, full verification, deployment smoke, MCP discovery, and live install markup pass.
- [x] 2026-07-24T17:59Z: Diagnosed the reported visual journals read-only: 44 recipes and 837 groceries have no stored `image_url`; all recipe items retain canonical and image-page URLs, while grocery items retain neither image-page nor image URLs. No household data changed, and Bead `fullwell-dt7` tracks an authorized, provenance-preserving capture and backfill workflow rather than runtime scraping.
- [x] 2026-07-24T05:42Z: Passed the Milestone 11 failure-oriented feature-critic gate after requiring write scope for cloud account rename, deterministic default-name output from the local profile boundary, explicit partial-state reporting across local/cloud renames, Git-derived household-title recovery, fixed-target runner control, and context-gated next-step copy.
- [x] 2026-07-24T05:35Z: Created and claimed Bead `fullwell-1ps`, updated the promoted onboarding brief, and framed the identity/control iteration with UX, privacy, architecture, reliability, and eval perspectives.
- [x] Milestone 10 - correct cross-host plugin-root resolution and require a healthy local MCP connection.
- [x] 2026-07-23T02:54Z: Live host smoke after installing public `1.1.9` proved Codex connected to both Fullwell servers but Claude only discovered `fullwell-local` and failed to start it. Created and claimed Bead `fullwell-gs8.15`; the published package remains immutable and the correction will ship as `1.1.10`.
- [x] 2026-07-23T03:04Z: Milestone 10 complete locally - prepared `1.1.10` with equivalent Codex and Claude path adapters, real-path-safe stdio startup, a Claude `Connected` lifecycle assertion, and synchronized package, architecture, product, changelog, and reliability evidence.
- [x] 2026-07-23T03:04Z: Passed all 20 package/lifecycle tests, the 45-case cross-host eval matrix, official Claude manifest validation, 29 WebKit checks with seven intentional skips, and full repository verification with 289 deterministic application tests and 11 expected database skips. The 21-entry dry pack has SHA-1 `58b0bd7fed9d69412461e6cd7323d2d5324628b0` and SHA-512 `sha512-WIquteSMO0Mun9i7J/twve3Fxd34XhrI0I58yWgJ8wiIyDnYaF3M+5FbSMzjE+jx7H4FTdInHqDV+9Nmo48ORQ==`; publication and current-host upgrade are not yet claimed.
- [x] 2026-07-23T03:08Z: Pushed correction commit `ac4e231`, published immutable public `@fullwell/fullwell@1.1.10` as npm `latest`, matched registry checksums to the prepared artifact, passed both lifecycles from a clean registry install, and upgraded current Codex and Claude to enabled `1.1.10`. Current Claude reports the installed `fullwell-local` server as `Connected`; no application-server deployment was necessary.
- [x] Milestone 9 - replace version-specific local helper commands with a stable host-native local tool boundary.
- [x] 2026-07-23T02:27Z: Created and claimed Bead `fullwell-gs8.14`; traced the repeated approval to the immutable plugin cache path changing on every release and confirmed that Codex npm plugin installs intentionally do not run lifecycle scripts.
- [x] 2026-07-23T02:27Z: Completed the Milestone 9 failure-oriented critique. The implementation must use stable server/tool identities rather than a mutable self-installed executable, keep load/update/delete approval semantics separate, remain dependency-free and offline, preserve the existing bounded runtime, fail closed when the local server is unavailable, and prove both host lifecycle compatibility.
- [x] 2026-07-23T02:40Z: Milestone 9 complete locally - prepared package `1.1.9` with the plugin-provided `fullwell-local` stdio server, stable read/update/delete tool identities, truthful approval annotations, fail-closed skill routing, and isolated Codex and Claude discovery coverage.
- [x] 2026-07-23T02:40Z: Passed 20 package/lifecycle tests, the 45-case cross-host eval matrix, package validation, 29 WebKit checks with seven intentional skips, and full repository verification with 289 deterministic application tests and 11 expected database skips. The 20-entry dry pack has SHA-1 `a9f9474924de809d4df879ee81ff11260ca423b2` and SHA-512 `sha512-iS8nSYRT8c4520KM6XwyHMxG7Fz2HB18ghTsaQexkl2I8otY9IEeFRoUuzkPuMgDRsYsWQOWvnE9HXywXGGHBg==`; no commit, publication, host upgrade, or server deployment is claimed.
- [x] 2026-07-23T02:51Z: Pushed implementation commit `cbc16c9`, published immutable public `@fullwell/fullwell@1.1.9` as npm `latest`, matched the registry SHA-1 and SHA-512 to the prepared artifact, and passed isolated Codex and Claude lifecycles from a clean registry install with both MCP servers discovered. The server application was unchanged and was not redeployed.
- [x] Milestone 8 - make new-user onboarding local-first before OAuth, preserve direct local utility, and promote to cloud only after an explicit backup choice.
- [x] 2026-07-22T23:58Z: Milestone 8 complete locally - added the private revisioned guest-household runtime, routed fresh and resumed conversations without pre-consent MCP calls, preserved direct local grocery/recipe use, made cloud backup an explicit non-destructive promotion, prepared package `1.1.8`, and synchronized install, architecture, security, reliability, product, changelog, and privacy guidance.
- [x] 2026-07-22T23:58Z: Passed seven local-runtime tests, the 44-case cross-host eval matrix, all 15 packaging/lifecycle tests, package build, 289 deterministic application tests with 11 expected database skips, and 29 WebKit checks with seven intentional skips. The final dry pack contains 19 entries with SHA-1 `f88bc7c0623a51956e9c5db2cea186a2d4dfeb0c`; no commit, publication, host upgrade, or server deployment is claimed.
- [x] 2026-07-22T23:58Z: Attempted `artifacts/screencasts/local-first-fullwell-onboarding.mp4`; Homebrew FFmpeg 8.0.1 rejected the helper's Linux-only `x11grab` input with code 234, so no MP4 was produced.
- [x] 2026-07-23T00:05Z: Added Bead `fullwell-gs8.12` and a success-gated completion handoff that invites one concrete out-of-stock restocking request after local finalization or hosted commit, names learned product/store history, preserves cart confirmation, and stays absent after unsuccessful or no-grocery runs.
- [x] 2026-07-23T00:07Z: Passed the 44-case cross-host eval matrix, all 15 package/lifecycle tests, package validation, documentation and ExecPlan gates, and the complete repository verification with 289 application tests and 11 expected database skips. The first full run reported an unrelated post-test local-runner `EPIPE`; its isolated two-test rerun and the complete verification rerun passed without code changes.
- [x] 2026-07-23T01:55Z: Pushed implementation commit `cade45e`, published immutable public `@fullwell/fullwell@1.1.8` as npm `latest`, matched the prepared SHA-1 and SHA-512 against registry metadata, and passed isolated Codex and Claude lifecycles from a clean registry install. The server was unchanged and was not redeployed.
- [x] 2026-07-22T23:12Z: Passed the Milestone 8 failure-oriented feature-critic gate after requiring remembered guest routing, zero remote discovery calls, durable direct local utility, semantic reconciliation for non-empty hosted households, non-destructive failed promotion, exact-retry binding, forbidden local-data checks, and rollback-readable local state.
- [x] 2026-07-22T23:06Z: Created and claimed Bead `fullwell-gs8.11`; reframed the primary install journey around local value before cloud-account creation and decomposed the guest runtime, shared skill routing, cloud promotion, eval, packaging, and documentation work.
- [x] 2026-07-22T22:34Z: Pushed commit `681952e`, deployed checksum-matched Linux/amd64 image `hfj-staging:whole-grocery-20260722-1-runtime` with the prior image retained for rollback, published immutable `@fullwell/fullwell@1.1.7`, upgraded both current hosts, and passed public deployment, MCP, registry-integrity, and clean-install lifecycle checks.
- [x] 2026-07-22T21:24Z: Milestone 7 complete locally - mixed grocery kinds, canonical paths, one-pass low-frequency learning, broader runner snapshot/prompt, user messaging, dashboard counts, package `1.1.7`, 39 cross-host eval cases, 300 deterministic tests with 11 expected database skips, and 29 WebKit checks with seven intentional project skips pass.
- [x] 2026-07-22T21:10Z: Framed the grocery-history expansion with UX, semantic-data, privacy, reliability, and eval perspectives; claimed Bead `fullwell-gs8.7` and decomposed one-pass collection, first-class grocery kinds, restocking availability, and compatibility work.
- [x] 2026-07-22T21:10Z: Passed the Milestone 7 feature-critic gate after requiring below-threshold grocery identities, distinct standard/Japanese mayonnaise formulations, canonical item-area validation, legacy purchase-evidence readability, one shared order traversal, and runner-snapshot coverage.
- [x] 2026-07-22T03:27Z: Created and claimed Bead `fullwell-gs8`, read the architecture/specification/prior onboarding plan, and completed product, UX, security, reliability, and eval framing.
- [x] 2026-07-22T03:27Z: Decomposed the work into bounded snapshot, atomic mutation, agent/eval, and release milestones with explicit conflict, payload, recovery, and rollback behavior.
- [x] 2026-07-22T03:31Z: Passed the failure-oriented feature-critic gate after adding snapshot consistency, explicit final confirmation, unique optional section outcomes, legacy skipped-state behavior, a no-empty-commit skip-only path, and pre-confirmation payload checks.
- [x] 2026-07-22T05:42Z: Milestone 1 complete - added the lock-consistent bounded snapshot, strict 24th tool contract, unique final outcomes, and truthful MCP annotations.
- [x] 2026-07-22T05:42Z: Milestone 2 complete - implemented canonical one-commit finalization, skip-only no-Git finalization, exact replay binding, and recovery-worker application of bounded skip intent.
- [x] 2026-07-22T05:42Z: Milestone 3 complete - updated the shared Codex/Claude skills, package `1.1.3`, reference contract, and 32-case eval matrix to keep drafts in the active conversation and write only after final confirmation.
- [x] 2026-07-22T05:49Z: Built and checksum-verified the Linux/amd64 OCI index, deployed `hfj-staging:onboarding-20260721-1-runtime`, retained `hfj-staging:mcp-meta-20260721-1-runtime` as rollback, and passed public readiness, deployment, and MCP discovery smokes at schema `0007`.
- [x] 2026-07-22T05:52Z: Re-ran the required screencast command; Homebrew FFmpeg 8.0.1 rejected its Linux-only `x11grab` input with code 234, so no MP4 was produced.
- [x] 2026-07-22T05:58Z: Published immutable `@fullwell/fullwell@1.1.3`, matched the prepared registry checksum, passed downloaded Codex/Claude lifecycle tests, and updated both current host installations to enabled `fullwell@fullwell` version `1.1.3`.
- [x] 2026-07-22T05:58Z: From the separate `fullwell-tester` folder, current Codex on `gpt-5.6-sol` made exactly one Fullwell call (`hfj_get_context`), no Fullwell mutation, and asked the snack question without the generic "what's on your mind" reply; the transcript filter retained only tool identity and boolean response checks.
- [x] 2026-07-22T06:12Z: Replaced unexplained snack/recipe setup labels with benefit-first guidance and concrete restocking/recipe-recall examples, updated the client specification and eval invariants, prepared package `1.1.4`, and passed package validation plus isolated Codex and Claude lifecycles.
- [x] 2026-07-22T06:34Z: Published immutable `@fullwell/fullwell@1.1.4`, matched the prepared registry checksums, passed downloaded Codex/Claude lifecycle tests, updated both current hosts to enabled version `1.1.4`, and verified the benefit-first snack copy in a sanitized separate-folder current-Codex smoke with no Fullwell mutation.
- [x] 2026-07-22T06:50Z: Made grocery order listings discovery-only in the shared browser audit, required every qualifying order detail and complete-item expansion, added a cross-host incomplete-summary eval, prepared package `1.1.5`, and passed skill validation, the 33-case eval matrix, package validation, isolated host lifecycles, dry-run packing, and full repository verification.
- [x] 2026-07-22T17:13Z: Milestone 4 complete - exposed the stable authenticated user ID, bundled the identity/snapshot-bound local checkpoint runtime, updated shared Codex/Claude orchestration and privacy guidance, expanded to 35 eval cases, and passed eight package/lifecycle tests, 29 browser tests with seven intentional skips, dry-run package inclusion, and full repository verification.
- [x] 2026-07-22T17:44Z: Milestone 5 complete - pushed commit `917c7bc`, deployed the stable-user-ID server image with a retained rollback, published checksum-matched `@fullwell/fullwell@1.1.5`, upgraded both current hosts, and passed deployed, downloaded-package, and fresh-session local checkpoint resume/cleanup smokes with zero Fullwell mutations.
- [x] 2026-07-22T19:55Z: Reframed the live 196-item/804-evidence failure with UX, security, architecture, reliability, and eval lenses; traced the effective limit to onboarding schema caps plus the global one-megabyte parser rather than a domain constraint.
- [x] 2026-07-22T19:55Z: Passed the Milestone 6 feature-critic gate after adding route-specific parser scope, duplicate-item rejection, pre-commit repository-capacity checks, argument-vector-safe Git staging, exact/over-limit tests, response-size observation, and an explicit no-live-bulk-write rule.
- [x] 2026-07-22T20:06Z: Milestone 6 complete - raised only onboarding to 10,000 items and 10,000 evidence records, limited `POST /mcp` to 16 MiB while retaining the one-megabyte default elsewhere, added pre-Git capacity and argument-safe staging, prepared shared package `1.1.6`, and passed contract, server, security, load, eval, package, browser, and full repository gates.
- [x] 2026-07-22T20:22Z: Release audit found the newly disclosed `fast-uri` GHSA-v2hh-gcrm-f6hx advisory before deployment; refreshed only the affected transitive lockfile releases, restored zero production vulnerabilities, and discarded the pre-fix image from release consideration.
- [x] 2026-07-22T20:57Z: Pushed commits `b6b12db` and `785ec06`, deployed checksum-matched Linux/amd64 image `hfj-staging:onboarding-capacity-20260722-2-runtime` with the prior image retained for rollback, published immutable `@fullwell/fullwell@1.1.6`, upgraded both current hosts, and passed public deployment, MCP, live parser-boundary, registry-integrity, and clean-install lifecycle checks.

## Surprises & Discoveries

- 2026-07-27: Chat household renaming is already implemented and covered by the `change-connected-household-name` cross-host eval. The web feature should call the same `hfj_update_household_name` service use case rather than create another naming authority.
- 2026-07-27: The current browser household summary omits the Git HEAD, so an exact-view rename needs a bounded repository revision in the private render context. Using a fresh server-side HEAD would silently overwrite a change made after the page loaded.
- 2026-07-27: A desktop-only hover affordance would be undiscoverable by keyboard and touch users. The title control must reveal on `:focus-within`, remain visible for coarse/no-hover pointers, and retain a direct no-JavaScript form.
- 2026-07-24: A preferred name cannot live only in the guest household document because an existing-account user must remember it locally before OAuth without creating a false guest authority. A separate private local profile is the smallest authority-neutral boundary.
- 2026-07-24: Account display-name updates already exist for browser sessions through `AccountService`, but chat has no cloud tool for them. Household titles are Git-authoritative while their Neon `households.display_name` value is a projection; a safe rename needs a Git mutation plus reconciliation that reprojects `household.md`.
- 2026-07-24: Stopping the WhatsApp runner and stopping the weekly reminder are unrelated operations. The runner is one fixed macOS LaunchAgent and should stop without revoking or purging connection state; the reminder belongs solely to the Codex or Claude native task named `Fullwell weekly meal planning`.
- 2026-07-24: Claude accepts the local household-update operation union only when its JSON Schema also declares the required top-level object type. Discovery tests must validate every exposed tool schema through Claude's stricter contract, not only the server process connection.
- 2026-07-24: The visual recipe and grocery pages were rendering their contract correctly; the live journal records contain null image fields. Rendering cannot recover omitted source imagery without reinspection, and server-side page scraping would violate the existing explicit source-authorization and provenance boundary.
- 2026-07-24: The first release image build surfaced newly reviewed `@fastify/static` path-bypass advisories. The vulnerable image never left the local build host; upgrading to 10.1.2 restored a zero-vulnerability production audit before the replacement image was transferred.
- 2026-07-23: Claude ignores the shared MCP declaration's relative `cwd`, so discovery-only lifecycle assertions allowed `node ./runtime/local-household-mcp.mjs` to pass packaging while failing live connection health. Claude's documented `${CLAUDE_PLUGIN_ROOT}` substitution is the portable MCP path boundary; lifecycle acceptance must assert `Connected`, not merely the server name.
- 2026-07-23: Codex does not expand `${CLAUDE_PLUGIN_ROOT}` in an MCP argument, so one physical MCP config cannot express both current hosts' path semantics without a shell. Two minimal host transport adapters preserve the same server and tool identities without adding shell evaluation. The strengthened lifecycle also exposed that macOS canonicalizes temporary `/var` and `/tmp` paths through `/private`, requiring the server's main-module guard to compare real paths.
- 2026-07-23: A marketplace package cannot safely create `~/.codex/fullwell/bin/local-household-v1` during installation because Codex downloads npm plugin packages without running lifecycle scripts. A plugin-provided local MCP server gives the same upgrade-stable permission boundary through a stable server and tool identity without letting the package modify the user's command allowlist or install mutable executable code outside its cache.
- 2026-07-22: The current local checkpoint cannot serve an unauthenticated person because its path and validity are bound to a Fullwell user ID, household ID, hosted repository HEAD, and hosted onboarding revisions. A guest path needs its own durable local identity and revision boundary rather than fake server identifiers.
- 2026-07-22: Delaying only the final write is insufficient. If the first `hfj_get_context` call remains mandatory, MCP OAuth still precedes all product value. The shared skill must ask the cloud-account question before calling any hosted tool.
- 2026-07-22: Local onboarding data must be readable by ordinary direct grocery and recipe requests; otherwise declining cloud backup creates a dead-end artifact rather than a usable local product.
- 2026-07-21: Codex tool approval is host-owned. A plugin cannot grant itself a temporary onboarding approval lease, so Fullwell must reduce its own call count and truthfully annotate tool effects rather than trying to suppress host safety policy.
- 2026-07-21: The current audit path intentionally commits evidence before conclusions, which creates at least two Git writes per section. A one-write onboarding path must validate newly submitted evidence and conclusions together without weakening the evidence-first semantic rule.
- 2026-07-21: Per-user skip state is Neon operational data, while completed state is derived from canonical Git reports. A mixed complete/skip finalization therefore crosses the existing Git and Neon recovery boundary and must retain bounded recovery intent in the mutation record.
- 2026-07-21: A complete existing-item corpus is not safe to embed in `hfj_get_context`. The snapshot must expose only bounded identity summaries and signal truncation; ambiguous existing-item conflicts may require an additional read rather than silently merging.
- 2026-07-22: The initial implementation exposed the generic mutation runner's historical completed-replay behavior, which did not compare a changed payload after success. The new final onboarding tool now retains and checks its request fingerprint on completed replay without changing legacy tool behavior.
- 2026-07-22: Adding the combined boundary initially reduced repository branch coverage from 90.07% to 89.58%. Contract and service edge tests for empty/duplicate input, no-household snapshots, invalid completion/skip, stale HEAD, changed replay, and unchanged skips restored the enforced gate to 90.03%.
- 2026-07-22: The authorized context exposed only the user's display name. Safe local sharding requires the stable authenticated Fullwell user ID, so the read response must add that non-secret identifier before a draft can be resumed.
- 2026-07-22: Conversation-only state did not survive compaction or a closed chat during long browser audits. A bounded local checkpoint solves that failure without adding another canonical Fullwell write, provided stale snapshots and concurrent local writers fail closed.
- 2026-07-22: The live Codex smoke showed that ad hoc shell construction of the helper's stdin JSON is error-prone. The packaged lifecycle and runtime tests cover the boundary, but future client ergonomics should provide a host-native wrapper so an agent never needs to recover a hidden identifier by inspecting the draft root; the successful release smoke ultimately loaded and deleted only the context-bound shard.
- 2026-07-22: A real grocery audit produced 196 items and 804 evidence records, proving the original 100/500 caps were below normal user data. The actual coupled constraints are the one-megabyte global HTTP parser, the 16 MiB local checkpoint, Git's 10,000-file reconciliation guard, and argument-vector growth when staging thousands of paths.
- 2026-07-22: The compact 10,000-item/10,000-evidence service fixture commits and exactly replays in about 0.6 seconds in the full deterministic suite. A real isolated Git repository commits 20,000 onboarding paths in under nine seconds without process argument expansion, so no live household bulk write was needed for acceptance evidence.
- 2026-07-22: The first release image build surfaced a new high-severity `fast-uri` advisory despite the preceding application gates. The immutable artifact was not deployed; updating the three affected transitive lock entries to patched releases restored a zero-vulnerability production audit before rebuilding.

## Decision Log

- 2026-07-27: Add an owner-only browser POST that delegates to `hfj_update_household_name` with the page's exact repository HEAD, CSRF token, and per-render idempotency key. Keep `household.md` authoritative and reuse normal reconciliation rather than adding a database-only rename.
- 2026-07-27: Place the edit affordance directly beside the household overview title. Hide it visually until title hover/focus on precise pointers, keep it keyboard focusable, and show it persistently on touch. The dialog starts with the current name selected, restores focus on close, supports Escape/backdrop cancellation, and provides a no-JavaScript inline form.
- 2026-07-27: Add a public `/guides/household-name` guide that presents chat and website as equivalent entry points to the same owner-only cloud rename. Keep the existing connected local/cloud partial-result guidance unchanged.
- 2026-07-24: Store the preferred member name in a revisioned private local profile under the active Codex home, separate from the optional guest household. Store the local household title inside its existing bounded journal document so older local runtimes can still read the top-level schema.
- 2026-07-24: Add purpose-specific `hfj_update_user_display_name` and `hfj_update_household_name` cloud tools. The first is an idempotent `journal:write` operational identity update with no household ID; the second is an owner-only, expected-HEAD Git mutation whose `household.md` title is reprojected into Neon during ordinary completion and reconciliation.
- 2026-07-24: Derive a first-household default by trimming the confirmed display name, using an apostrophe alone for names ending in `s` or `S`, and otherwise using apostrophe-s. Never apply that default while accepting a pending invitation or when any household already exists.
- 2026-07-24: Use `Hi Fullwell.` as Claude's public first instruction because it reads as a direct greeting and still routes through the same name-first managing skill. Retain `@Fullwell hi` for Codex because its explicit installed-plugin mention is part of that host's handoff contract.
- 2026-07-24: Keep connected visual journal rendering recorded-only. Existing missing images require an explicit authorized backfill that records exact image provenance; the server must not fetch private recipe or retailer pages implicitly during page rendering.
- 2026-07-24: Add a fixed-purpose local MCP tool that stops and removes only the Fullwell WhatsApp LaunchAgent definition while retaining Keychain credentials, runner configuration, snapshots, receipts, server device registration, and WhatsApp linkage. Full disconnect remains a separate CLI/account action.
- 2026-07-24: Interpret an explicit request to stop or remove the weekly meal reminder as removal of the exact host-native task after listing/reconciliation; `pause` remains the non-destructive temporary action.
- 2026-07-23: Resolve the local MCP script through `${CLAUDE_PLUGIN_ROOT}` in the shared manifest and remove dependence on process working directory. Keep the stable server/tool identities unchanged, require both hosts to expand the installed package path, and make Claude lifecycle verification prove the server connects.
- 2026-07-23: Supersede the single-manifest path decision after current Codex proved it does not expand Claude's placeholder. Use `codex-mcp.json` with plugin-root `cwd` for Codex and `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}` for Claude; validate that only path resolution differs, and canonicalize the executable script path before deciding whether to run the stdio main loop.
- 2026-07-23: Replace direct execution of the versioned `runtime/local-household.mjs` cache path with three tools on a dependency-free plugin-provided `fullwell-local` MCP server: read-only load, non-destructive revisioned update, and destructive collecting-only deletion. Stable MCP identities, rather than a broad `node` rule or a self-modifying allowlist, carry one-time host permission across package upgrades.
- 2026-07-22: Make the default new-user authority a single local guest household under the active Codex home. Do not synthesize Fullwell user or household IDs and do not call the hosted MCP service until the user says they already have a cloud account or explicitly chooses cloud backup.
- 2026-07-22: Treat cloud enablement as an explicit promotion, not background sync. Persist locally first, authenticate only after consent, reconcile against the selected hosted household, use the existing idempotent onboarding commit, and retain the local journal unless the user separately deletes it.
- 2026-07-22: Keep WhatsApp, collection sharing, invitations, and multiplayer cloud-account-gated. Direct local grocery restocking and recipe recall must work without a cloud account.
- 2026-07-22: Keep `snacks` as the internal onboarding section, profile, completion-report type, and legacy path for backward compatibility, but describe the section to people as grocery-history onboarding for snacks, ingredients, condiments, and other groceries.
- 2026-07-22: Add first-class `ingredient`, `condiment`, and `other_grocery` journal item kinds beside `snack` and `recipe`. Store them under `ingredients/items/`, `condiments/items/`, and `groceries/items/`; write new purchase evidence under `groceries/evidence/` while continuing to read legacy `snacks/evidence/`.
- 2026-07-22: One authorized order-detail traversal must classify every in-scope grocery line into an evidence-backed item. The recurrence threshold controls report inclusion, not whether a low-frequency item such as parsley is learned. Semantic classification remains agent-authored rather than keyword code.
- 2026-07-22: The restocking snapshot includes all four grocery item areas plus legacy and current purchase evidence. Historical formulations remain separate, so a negative qualifier such as "not the Japanese one" filters candidates instead of merging mayonnaise identities.
- 2026-07-22: Supersede the conversation-only draft decision. Store a versioned JSON checkpoint under `~/.codex/fullwell/drafts/<user-id>/<household-id>/onboarding.json`, or the active Codex home equivalent, with `0700` directories and `0600` atomic files. The user explicitly accepts that another person with access to the same operating-system account can read it; the required boundary is preventing accidental Fullwell user or household mixing, not encryption at rest.
- 2026-07-22: Bind every checkpoint to the authenticated Fullwell user ID, household ID, repository HEAD, both onboarding revisions, and a local draft revision. Never scan another identity shard, merge a stale checkpoint, or store credentials, cookies, browser state, access tokens, refresh tokens, or raw page captures.
- 2026-07-22: Delete the matching checkpoint after a confirmed commit or explicit whole-flow cancellation. Expired, malformed, mismatched, or concurrent-write-conflicted checkpoints fail closed and leave canonical Fullwell state unchanged.
- 2026-07-21: Extend `hfj_get_context` instead of adding another initial-read tool. One selected-household response can safely carry profiles and a bounded item index after the existing membership check.
- 2026-07-21: Add one purpose-specific `hfj_commit_onboarding` tool rather than broadening `hfj_commit_change_set`. The new contract can require section outcomes, bound the combined payload, and coordinate per-user operational skip state without changing ordinary journal updates.
- 2026-07-21: A `complete` section outcome is accepted only when the same request writes the matching canonical report or the report already exists. The agent still cannot persist an independent completion flag.
- 2026-07-21: Preserve `hfj_update_onboarding` for backward compatibility and resumable older clients, but the new shared skills do not call it during an ordinary read-draft-commit run.
- 2026-07-21: Treat one Fullwell read and one Fullwell write as the target, not an absolute promise across every household. Truncated item indexes, stale HEADs, payload limits, authorization changes, or explicit conflict resolution fail closed and may require another user-approved read or retry.
- 2026-07-21: Represent only changed section outcomes in a unique bounded array. Already-complete sections and an unchanged prior skip are omitted; completing a previously skipped section needs the canonical report but no synthetic `resume` write.
- 2026-07-21: A final skip-only request with no canonical file changes completes as one Neon operational mutation against the current HEAD. It never creates an empty Git commit or stores per-user skip state in the shared household repository.
- 2026-07-22: Raise only `hfj_commit_onboarding` to 10,000 evidence and 10,000 items; keep ordinary append/change-set batch sizes unchanged. Give `/mcp` a 16 MiB route-specific body limit matching the local checkpoint while retaining the one-megabyte default everywhere else. Raise the full-repository reconciliation guard only enough to contain one maximum fresh onboarding commit plus system files, and stage the isolated mutation worktree without enumerating every path in the process argument vector.

## Context and Orientation

`packages/contracts/src/tools.ts` owns the stable MCP tool union and strict input schemas. `packages/contracts/src/onboarding.ts` owns section states and bounded skip reasons. `apps/server/src/http/app.ts` publishes tool metadata. It currently publishes names, descriptions, and input schemas without MCP tool annotations.

`apps/server/src/services/household-food-journal.ts` implements `hfj_get_context`, profile/item reads, evidence append, change-set commits, and per-user onboarding transitions. `apps/server/src/services/mutation-runner.ts` owns the signed Git commit and durable mutation-state lifecycle. `apps/server/src/core/ports.ts`, `apps/server/src/core/types.ts`, `apps/server/src/adapters/memory.ts`, `apps/server/src/persistence/neon-operational-store.ts`, and `apps/server/src/workers/reconciliation-worker.ts` own operational state, projections, and recovery.

The shared host behavior lives in `packages/agent-client/skills/manage-household-food-journal/SKILL.md`, `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`, and `packages/agent-client/skills/track-recipe-history/SKILL.md`. `packages/agent-client/runtime/onboarding-draft.mjs` owns the authenticated checkpoint boundary, while `packages/agent-client/runtime/local-household.mjs` owns the account-free guest authority and optional cloud-link marker; both are bundled for both hosts. `packages/agent-client/evals/cases/v1.json`, `packages/agent-client/evals/expected/v1.json`, and `packages/agent-client/tests/evals/matrix.test.mjs` make tool order and forbidden behavior deterministic across Codex and Claude.

`apps/server/src/account/service.ts` already renames a signed-in browser user's display name through the private identity store, but that behavior is not available to MCP chat. `household.md` is the exported household title authority, while `households.display_name` is the operational read projection used by context and browser views. `packages/local-runner/src/launchd.ts` owns the durable runner lifecycle, and `packages/agent-client/references/weekly-meal-planning-automation.md` owns the separate host-native reminder lifecycle.

For the browser naming iteration, `apps/server/src/http/web.ts` owns strict form parsing and the server-rendered POST/redirect boundary, while `apps/server/src/http/web-view-model.ts` authenticates the browser principal, verifies CSRF, and delegates to `HouseholdFoodJournalService`. `apps/web/src/routes/household-overview.tsx` owns the visible household title, `apps/web/src/context.tsx` validates the serialized private render model before hydration, and `apps/web/src/routes/guides.tsx` owns the public online guides. `apps/web/src/components/confirm-action-form.tsx` demonstrates the repository's native `<dialog>` cancellation and focus-return pattern.

Assumptions and constraints:

- The normal acceptance path begins with an existing editable household whose item index is not truncated and whose combined onboarding payload fits the `/mcp` route's 16 MiB body limit. The 10,000-record count limits do not override per-field schemas or this independent byte bound.
- The initial read does not authorize browsing. Each source and browser remains explicitly user-authorized.
- Draft answers and bounded evidence are local and resumable until final user confirmation. A stopped or abandoned conversation performs no Fullwell write; a matching, current checkpoint can resume after host context loss.
- Git remains authoritative for evidence, items, profiles, and reports. Neon remains authoritative for per-user skipped state and mutation recovery metadata.
- Programs validate evidence relationships, revisions, report arithmetic, and allowed paths but do not classify foods, resolve semantic identity, or author report prose.
- One successful finalization creates one signed Git commit when canonical files change. A skip-only finalization uses one operational transaction against the current HEAD and never creates an empty Git commit or a private per-user Git document.

## Framing Notes

### Expert panel

- UX expert - minimize approval fatigue without hiding the final consequential write.
- Security and privacy researcher - preserve source consent and keep sensitive drafts out of unmanaged local files.
- Staff architect - combine existing evidence/profile/report behavior without weakening Git authority or multiplying tools.
- Reliability engineer - make mixed Git and Neon outcomes replayable across crashes, retries, and stale hosts.
- Applied ML and eval engineer - keep semantic decisions in the host model and prove the two-call orchestration across both hosts.

### What problem are we actually solving?

The problem is not merely the number of tool calls. It is that Fullwell persists workflow bookkeeping while the user is still answering questions, forcing the host to request approval before the user has reached a meaningful decision. The workflow should remain a reversible draft until the user reviews one complete result.

### Roundtable highlights

- UX: read once, ask uninterrupted questions, preview the intended changes, then request one clearly labeled final write.
- Security/privacy (superseded by the 2026-07-22 user decision): never interpret the initial read as permission to inspect browser sources. The selected local checkpoint deliberately favors resumability and identity separation over encryption from another person using the same operating-system account.
- Architecture: submit new evidence and the conclusions citing it in the same typed request, validate against a combined existing-plus-new evidence map, and commit all canonical changes once.
- Reliability: bind the final request to the snapshot HEAD, item revisions, onboarding revisions, and an idempotency key; persist bounded skip recovery intent before the Git boundary.
- ML/evals: forbid `hfj_update_onboarding`, profile writes, evidence appends, and change-set writes before final confirmation in the normal onboarding eval.

### Key tensions

- Fewer approvals versus persistent cross-session progress.
- One final payload versus the one-megabyte request boundary and large purchase histories.
- Ten-thousand-record count support versus bounded parser memory, Git process arguments, repository reconciliation, and the 1 GiB staging host.
- Atomic canonical Git content versus per-user operational skip state.
- Bounded context snapshots versus complete semantic duplicate review.

### Synthesis for decomposition

Prove the combined contract and validation first. Then integrate recovery and one-commit persistence. Only after the server boundary passes race/replay tests should the shared skills stop making intermediate mutations. Roll out the server before publishing the client, retain old tools through the compatibility window, and verify the exact current Codex host call sequence against staging.

For the local-first iteration, the UX lens requires useful grocery and recipe behavior before sign-in and a single plain-language account question before any hosted call. The privacy lens requires that local state exclude credentials, cookies, browser state, screenshots, raw HTML, and raw page captures. The architecture lens treats guest storage as a separate local authority realm rather than weakening the hosted server's sole-writer rule. The reliability lens requires revision-checked atomic writes, resumability, and non-destructive retry after failed cloud promotion. The eval lens must prove both hosts make zero Fullwell calls on the guest path and begin OAuth only after an affirmative account or backup choice.

For the 10,000-record correction, the UX lens requires one final approval to cover a real audit rather than forcing artificial partial saves. The security lens requires a route-specific byte ceiling instead of globally accepting large bodies. The reliability lens requires exact-limit and over-limit tests plus a Git staging path that does not depend on operating-system argument limits. The architecture lens keeps the ordinary mutation tools small and changes only the onboarding aggregate. The eval lens requires both hosts to treat a within-limit large draft as one final write, not as permission to split or pre-write it.

For the identity and conversational-control iteration, the UX lens requires the name question to precede account and household questions, while avoiding a generic menu or redundant rename prompt. The privacy lens treats names and household titles as private content that must never enter telemetry, runner output, scheduled prompts, or public collection data. The architecture lens separates person identity from household authority, keeps cloud household titles Git-authoritative, and uses one exact local runner control rather than shell instructions. The reliability lens requires revision checks for both local files, idempotent cloud updates, projection recovery after a household-name commit, and confirmed host results before claiming a runner or reminder stopped. The eval lens requires both hosts to cover fresh, resumed, joined, possessive-name, rename, stop, and conditional next-step paths.

## Milestones

### Milestone 1 - Snapshot, commit contract, and tool metadata

Files:

- `packages/contracts/src/onboarding.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`

Tasks:

1. Define strict section-outcome and combined onboarding finalization schemas using the existing evidence, item, report, profile, HEAD, item-revision, onboarding-revision, and idempotency types.
2. Bound combined evidence/items/reports/profiles so the normal request fits the existing HTTP limit; reject empty finalizations, duplicate sections, impossible completion claims, and malformed recovery intent.
3. Extend selected-household `hfj_get_context` output with snack/recipe profiles and a bounded item identity index plus a `truncated` signal. Under the household lock, require repository HEAD, household projection HEAD, and membership projection HEAD to agree before returning the snapshot. Do not return it before membership authorization.
4. Publish truthful MCP annotations for read-only, idempotent, destructive, and open-world behavior. Keep the annotation mapping explicit for security-sensitive tools.
5. Raise the stable catalog to 24 tools while retaining `hfj_update_onboarding` for old clients.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- http/app.test.ts services/household-food-journal.test.ts`
- `npm run typecheck --workspace @hfj/server`

### Milestone 2 - Recoverable one-write finalization

Files:

- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/mutation-runner.ts`
- `apps/server/src/workers/reconciliation-worker.ts`
- `apps/server/src/core/types.ts`
- `apps/server/src/adapters/memory.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/workers/reconciliation-worker.test.ts`
- `tests/load/concurrency.test.ts`
- `tests/security/boundaries.test.ts`

Tasks:

1. Validate new evidence IDs and corrections against existing plus same-request evidence, then validate item evidence and report assertions against the combined prospective state.
2. Build one repository change list for evidence, item documents, canonical reports, and changed snack/recipe profiles; reject duplicate paths, duplicate section/profile entries, and a `complete` outcome without its report.
3. Run the finalization through the household lock and existing mutation states: `received`, `locked`, `git_committed`, `projections_applied`, and `completed`.
4. Persist only bounded recovery metadata for per-user skip outcomes before the Git boundary. On retry or reconciliation, apply each skip compare-and-set idempotently and never expose internal recovery fields in MCP output. If the request has no canonical changes, finish the same durable mutation and skip compare-and-sets inside one household-scoped Neon transaction using the unchanged current HEAD.
5. Reject stale household HEAD, stale item or onboarding revision, viewers, changed idempotency payloads, duplicate evidence, oversized input, and a concurrent member update without a partial success response.
6. Return final derived onboarding status in the write response so the client needs no follow-up read.

Verification:

- `npm run test --workspace @hfj/server -- services/household-food-journal.test.ts workers/reconciliation-worker.test.ts`
- `npm run test:contract`
- `npm run test:security`
- `npm run test:load`

### Milestone 3 - Shared conversational draft and evals

Files:

- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Make one `hfj_get_context` snapshot the only normal Fullwell read before finalization. Reuse its profiles and item summaries without calling profile/search/item tools unless the snapshot explicitly reports a truncation or ambiguity.
2. Keep source answers, evidence, semantic decisions, profile edits, reports, and bounded skip reasons in the identity-sharded local checkpoint. Do not write a workspace draft, opt the draft into host memory, or treat the checkpoint as canonical household state.
3. Before asking for confirmation, ensure the draft is within the advertised evidence/item/report/profile and request-size bounds. Ask the user to review a concise final summary and explicitly confirm the write, then call `hfj_commit_onboarding` exactly once. Do not call `hfj_update_onboarding`, `hfj_update_profile`, `hfj_append_evidence`, or `hfj_commit_change_set` during the normal draft.
4. Preserve snack-before-recipe order, natural section decline, explicit whole-flow stop, browser/source authorization, semantic food rules, and no false completion.
5. Add cross-host evals for two-call success, mixed complete/skip, skip-only finalization, explicit stop with zero writes, stale final commit, truncated inventory, oversized draft, and no intermediate mutation.
6. Prepare the next immutable package version and validate both host lifecycle adapters from the packed artifact.

Verification:

- `npm run test:evals`
- `npm run test:packaging`
- `npm run build --workspace @fullwell/fullwell`

### Milestone 4 - Identity-sharded local checkpoint

Files:

- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `packages/agent-client/runtime/onboarding-draft.mjs`
- `packages/agent-client/tests/packaging/onboarding-draft.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/evals/`

Tasks:

1. Add the stable authenticated Fullwell user ID to `hfj_get_context.user` and verify that each principal receives only its own ID after the existing authorization boundary.
2. Bundle a dependency-free Node checkpoint helper with a strict versioned JSON boundary, safe opaque-ID path derivation, a bounded payload, 30-day expiry, atomic same-directory rename, `0700` directories, `0600` files, exact snapshot matching, and optimistic local draft revisions.
3. Load only the exact current user/household shard after `hfj_get_context`. Ignore malformed, expired, identity-mismatched, HEAD-mismatched, or onboarding-revision-mismatched data; never search sibling shards or merge stale content.
4. Save after meaningful audit progress without making a Fullwell mutation. Delete after a successful `hfj_commit_onboarding` response or explicit whole-flow cancellation, but retain it after uncertain, failed, or conflicted remote writes so recovery remains possible.
5. Add deterministic helper tests and cross-host eval assertions for resume, isolation, stale/corrupt failure, concurrent local writers, cleanup, package inclusion, and prohibited credential/browser-state persistence.

Verification:

- `npm run test --workspace @hfj/server -- services/household-food-journal.test.ts`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`

### Milestone 5 - Documentation, rollout, and live evidence

Files:

- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/ideas/backlog/conversational-fullwell-onboarding.md`
- `CHANGELOG.md`
- `docs/IMPLEMENTATION_LOG.md`
- `docs/release/verification-evidence.md`

Tasks:

1. Document local identity-sharded drafts, bounded snapshots, one final write, payload/conflict fallbacks, annotations, authority, recovery, and compatibility.
2. Run doc-drift review and refresh generated knowledge only when the tracked tree or quality ledger requires it.
3. Capture the changed conversation flow with `npm run capture:screencast -- --output artifacts/screencasts/approval-efficient-onboarding.mp4`; if the host capture dependency remains unavailable, record the exact blocker and retain redacted host transcript evidence.
4. Run the complete local gate set, commit with the required `AI-Model` trailer, push, publish the immutable client package, and deploy an amd64 server image with the previous runtime as rollback.
5. Through a separate test folder and current Codex account, verify one initial Fullwell read, no intermediate Fullwell mutation, one final write only after explicit confirmation, derived completion, and no returned private values in the evidence transcript.

Verification:

- `npm run test:e2e`
- `npm run test:integration`
- `npm run test:security`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- staging`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- staging`

### Milestone 6 - Real-history onboarding capacity

Files:

- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/git/git-repository.ts`
- `apps/server/src/git/git-repository.test.ts`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/RELIABILITY.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Replace the onboarding-only item/evidence caps with named 10,000-record contract limits and reject 10,001 deterministically. Preserve ordinary evidence and change-set batch limits.
2. Raise only the MCP POST body parser to 16 MiB, matching the existing local checkpoint ceiling; retain the one-megabyte default for every other route and preserve generic, non-enumerating 413 behavior.
3. Reject duplicate item IDs at the contract boundary. Before writing, count the current tree plus distinct new paths and fail before Git when the resulting household would exceed the full-repository reconciliation ceiling. Let one maximum fresh onboarding mutation create more than 20,000 canonical paths without exceeding that ceiling or the operating system's argument-vector limit. Keep path validation, append-only evidence, signed commits, and rollback unchanged.
4. Add exact-limit, over-limit, above-one-megabyte HTTP, atomic service, replay, pre-commit repository-capacity, and bounded Git tests. The large success fixture must serialize below 16 MiB, produce one commit, and record the response size and elapsed time without logging content.
5. Teach both hosts that a confirmed draft within the 10,000/10,000 and 16 MiB bounds uses one `hfj_commit_onboarding` call; an over-count or over-byte draft remains local and reports the precise blocking bound without intermediate writes.
6. Update normative specs, reliability guidance, changelogs, implementation evidence, and the package version; run narrow gates before full verification and release.

Feature-critic constraints:

- The 16 MiB override applies only to `POST /mcp`; the global and direct HTTP tool defaults remain one megabyte so this change does not widen unrelated browser, OAuth, webhook, or tool routes.
- Count limits and byte limits are independent. Compact 10,000/10,000 fixtures must succeed, but maximum-length fields may hit 16 MiB first and must fail before service dispatch.
- A repository-capacity failure happens before the signed commit. A successful commit must never leave a tree that the reconciliation worker refuses to read.
- Duplicate item or evidence paths fail before Git, and staging uses the isolated worktree rather than passing 20,000 paths through `argv`.
- Do not drive a synthetic maximum-size write against the user's live household. Deployment smoke may exercise parser/tool discovery; deterministic and isolated Git tests own bulk-mutation evidence.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- http/app.test.ts services/household-food-journal.test.ts git/git-repository.test.ts`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:load`
- `npm run test:security`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 7 - One-pass whole-grocery learning

Files:

- `packages/contracts/src/domain.ts`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/domain/journal-validation.ts`
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/core/restocking-snapshot.ts`
- `apps/server/src/runner/snapshot-service.test.ts`
- `packages/local-runner/src/snapshot-cache.ts`
- `packages/local-runner/src/host/prompt.ts`
- `apps/server/src/http/web-view-model.ts`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/restock-groceries/SKILL.md`
- `packages/agent-client/references/semantic-food-rules.md`
- `packages/agent-client/references/restocking-and-cart-safety.md`
- `packages/agent-client/evals/`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Extend the strict journal-item and search contracts with `ingredient`, `condiment`, and `other_grocery`, retaining the existing grocery identity fields and semantic distinctions. Map each kind to a canonical item directory and reject a mismatched directory during projection rebuild.
2. Route new purchase evidence to the general grocery evidence area, continue rebuilding legacy snack evidence, and include all grocery item/evidence areas in the credential-free restocking snapshot. Preserve the existing snack profile and report paths as compatibility identifiers.
3. Make the authorized audit traverse each qualifying order detail once and author an evidence-backed item for every in-scope grocery identity during that pass. Apply the recurrence threshold only to report assertions; preserve observed store and exact product provenance for later source selection.
4. Teach restocking to resolve ingredients, condiments, and other groceries from the same closed historical candidate set. Keep formulations such as standard and Japanese-style mayonnaise separate and honor natural exclusions without introducing keyword classification code.
5. Replace snack-only benefit copy with friendly grocery-wide messaging and examples covering snacks, ingredients, condiments, and more. Keep the snack-then-recipe onboarding state order and the one-read/local-draft/one-write approval boundary unchanged.
6. Add contract, projection, service, runner-snapshot, packaging, and cross-host eval coverage for mixed-kind onboarding, below-threshold parsley, negative mayonnaise formulation selection, legacy evidence compatibility, and no second order-history pass.

Feature-critic constraints:

- A non-recurring item is still learned; only its omission from a recurrence report is allowed.
- The item kind and repository directory must agree, but legacy `snacks/evidence/` remains readable so existing households reconcile without migration.
- The runner snapshot must contain every new grocery item area and `groceries/evidence/`, or WhatsApp requests would appear supported while lacking product/source evidence.
- `snacks` remains the internal onboarding section/report compatibility key. Do not add a third onboarding section or force existing users to repeat setup.
- Agent instructions assign grocery kinds and interpret exclusions. Server and client programs validate enumerated structure only and never classify food names.
- Deploy the additive server contract before publishing the client that can emit new kinds. After a new-kind write, rollback must use a schema-compatible image rather than an older image that rejects the repository format.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- domain/journal-validation.test.ts domain/repository-projection.test.ts services/household-food-journal.test.ts runner/snapshot-service.test.ts`
- `npm run test --workspace @fullwell/local-runner -- src/snapshot-cache.test.ts src/host/adapters.test.ts src/runner.test.ts`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 8 - Local-first guest onboarding and optional cloud promotion

Files:

- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/audit-grocery-purchases/SKILL.md`
- `packages/agent-client/skills/track-recipe-history/SKILL.md`
- `packages/agent-client/skills/restock-groceries/SKILL.md`
- `packages/agent-client/skills/share-food-collection/SKILL.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `apps/web/src/routes/install.tsx`
- `docs/product-specs/household-food-journal-client.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Add a dependency-free local guest-household runtime under the active Codex home with a generated local identity, bounded JSON journal, monotonic revision, atomic `0600` writes inside `0700` directories, a lock, explicit collecting/ready state, and optional cloud-backup metadata. Reject credentials, cookies, tokens, browser state, screenshots, raw HTML, raw pages, unsafe paths, oversized documents, stale writes, and malformed state.
2. Route a fresh greeting through one cloud-account question before any hosted call. An affirmative existing-cloud-account answer starts the existing OAuth/context/household path. A negative answer initializes or resumes the local guest household and starts grocery-history questions immediately. A remembered guest household resumes without asking the cloud-account question again.
3. Reuse the same grocery and recipe semantic workflow in local mode, checkpoint after meaningful progress, finalize locally before offering cloud backup, and make later direct restocking and recipe recall read the finalized local journal without MCP. Natural section declines still advance; whole-flow cancellation removes only an unfinalized guest journal after explicit confirmation.
4. After local finalization, offer optional Fullwell cloud-account creation in benefit terms: cloud backup, WhatsApp, sharing, and family access. Only an affirmative answer may call `hfj_get_context`. Create or select a hosted household, reconcile local identities against the hosted snapshot, show the exact cloud copy/merge summary, call `hfj_commit_onboarding` once after confirmation, and record the returned user, household, HEAD, and local revision. Never delete or mark backed up after a failed or uncertain call.
5. Keep remote MCP configuration available but on-use. Account-gated requests from a guest, including WhatsApp and collection sharing, offer promotion instead of failing generically. Update install copy, shared specifications, architecture, changelogs, package version, Codex and Claude manifests/catalogs, and the implementation log.
6. Add deterministic runtime coverage and cross-host evals for first install/no cloud account, existing cloud account, guest resume, zero pre-consent Fullwell calls, local direct utility, declined backup, successful promotion, failed promotion retention, non-empty-hosted-household reconciliation, and prohibited local data.
7. After successful local finalization or hosted onboarding commit, invite a concrete out-of-stock restocking request when grocery evidence exists. Explain history-based product/store selection and retain explicit cart confirmation; never show the invitation after failed, cancelled, unfinished, or no-grocery completion.

Feature-critic constraints:

- Missing local state is the only condition that asks the cloud-account question automatically. A remembered guest journal resumes locally; an explicit later request to connect or back up may start OAuth.
- The remote MCP service must not be called to discover whether a cloud account exists. The user's answer is the routing decision.
- A local file is not a cloud backup and must not be described as one. Failed or declined promotion leaves the local journal authoritative and useful.
- Promotion into an existing hosted household requires semantic duplicate review and current hosted revisions; never overwrite or silently merge based on deterministic title matching.
- Local state stores bounded journal evidence and agent-authored conclusions only. It never stores retailer credentials, cookies, browser session state, screenshots, raw HTML, raw page captures, OAuth tokens, or one-time codes.
- Cloud linkage is recorded only from a successful hosted response. Exact retry reuses the same promotion payload and idempotency key; changed retry requires a new summary and confirmation.
- Package rollback leaves local guest data in place and readable by the released helper version. No server schema or deployment change is required because promotion reuses the existing hosted onboarding contract.

Verification:

- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run build --workspace @fullwell/fullwell`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 9 - Stable local runtime permission boundary

Files:

- `packages/agent-client/.mcp.json`
- `packages/agent-client/codex-mcp.json`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `docs/product-specs/household-food-journal-client.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Add a dependency-free stdio MCP server named `fullwell-local` beside the existing hosted server. Expose stable read-only load, non-destructive revisioned update, and destructive collecting-only deletion tools that delegate to the existing bounded local-household runtime and never use the network.
2. Route every guest load and mutation through those stable tool identities. Do not execute the immutable cache path directly, edit user rules, add a broad `node` allow rule, or install executable code outside the plugin cache.
3. Keep approval semantics truthful: load is read-only, initialize/save/finalize/cloud-link updates are non-destructive writes, and cancellation deletion remains destructive. Explain that a host may ask once before allowing local journal updates and that a persistent approval applies only to the named local tool.
4. Preserve the existing journal path, schema, revision checks, atomic private writes, limits, forbidden-data validation, and account-free behavior. A local-server startup or protocol error must fail closed with a reload/reinstall instruction and must not fall back silently to the versioned shell command or hosted MCP service.
5. Bump the immutable agent package and both host catalogs together. Add protocol, malformed-request, size, error-redaction, tool-annotation, packaging, lifecycle, and cross-host eval coverage.

Feature-critic constraints:

- The local server and tools keep stable names across patch and minor package versions; changing their security contract requires a new identity and fresh approval.
- The local server accepts only newline-delimited JSON-RPC over stdio, bounds every inbound line before parsing, emits no journal data to stderr or logs, and returns domain failures as explicit tool errors.
- Read and write operations cannot share a destructive annotation. Deletion must remain a separate tool so ordinary onboarding permission cannot authorize removal.
- The server delegates semantic storage validation to `local-household.mjs`; it must not duplicate or weaken the forbidden-data, revision, path, or size boundary.
- The remote `fullwell-cloud` server remains on-use and is never contacted by local tool startup or guest operations.
- Codex and Claude must both install and discover the same local MCP declaration from an isolated package copy.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run build --workspace @fullwell/fullwell`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 10 - Cross-host plugin-root correction

Files:

- `packages/agent-client/.mcp.json`
- `packages/agent-client/scripts/validate-package.mjs`
- `packages/agent-client/tests/packaging/host-lifecycle.test.mjs`
- `packages/agent-client/package.json`
- `packages/agent-client/.codex-plugin/plugin.json`
- `packages/agent-client/.claude-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `.claude-plugin/marketplace.json`
- `docs/product-specs/household-food-journal-client.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Keep Codex on a plugin-root working-directory adapter and give Claude `${CLAUDE_PLUGIN_ROOT}/runtime/local-household-mcp.mjs`; validate that both adapters retain the same server identity, remote endpoint, inherited environment, timeout, and packaged runtime.
2. Preserve the existing `fullwell-local` server and three tool identities so retained narrow approvals remain compatible. Do not add shell evaluation, an absolute user path, another launcher, or broader inherited environment.
3. Strengthen isolated lifecycle evidence: Codex must expose the installed-cache working directory, Claude must report the plugin-provided local server as connected rather than merely list its name, and the server main-module guard must survive macOS real-path canonicalization.
4. Publish the immutable `1.1.10` correction, verify registry checksums and clean downloaded lifecycles, update both current host installations, and record that no application-server deployment is required.

Verification:

- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run build --workspace @fullwell/fullwell`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`

### Milestone 11 - Remembered identity, household naming, and conversational controls

Files:

- `packages/agent-client/runtime/local-profile.mjs`
- `packages/agent-client/runtime/local-runner-control.mjs`
- `packages/agent-client/runtime/local-household.mjs`
- `packages/agent-client/runtime/local-household-mcp.mjs`
- `packages/agent-client/tests/packaging/local-profile.test.mjs`
- `packages/agent-client/tests/packaging/local-runner-control.test.mjs`
- `packages/agent-client/tests/packaging/local-household.test.mjs`
- `packages/agent-client/tests/packaging/local-household-mcp.test.mjs`
- `packages/contracts/src/tools.ts`
- `packages/contracts/src/contracts.test.ts`
- `apps/server/src/core/ports.ts`
- `apps/server/src/adapters/memory.ts`
- `apps/server/src/persistence/neon-operational-store.ts`
- `apps/server/src/domain/repository-projection.ts`
- `apps/server/src/domain/repository-projection.test.ts`
- `apps/server/src/services/household-food-journal.ts`
- `apps/server/src/services/household-food-journal.test.ts`
- `apps/server/src/workers/reconciliation-worker.ts`
- `apps/server/src/workers/reconciliation-worker.test.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/main.ts`
- `packages/agent-client/skills/manage-household-food-journal/SKILL.md`
- `packages/agent-client/skills/plan-household-meals/SKILL.md`
- `packages/agent-client/references/mcp-tool-contract.md`
- `packages/agent-client/references/privacy-and-sharing.md`
- `packages/agent-client/references/weekly-meal-planning-automation.md`
- `packages/agent-client/evals/cases/v1.json`
- `packages/agent-client/evals/expected/v1.json`
- `packages/agent-client/tests/evals/matrix.test.mjs`
- `packages/agent-client/scripts/validate-package.mjs`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`
- `packages/agent-client/CHANGELOG.md`

Tasks:

1. Add a revisioned private local profile containing only the confirmed display name and timestamps. Expose stable local profile load/update tools, require an exact expected revision including zero for first creation, use atomic `0600` replacement under `0700` directories, and never create a guest household merely to remember an existing-account user's name. Return the deterministic possessive first-household default from this boundary so local and cloud creation do not depend on host phrasing.
2. Make the first conversational question after a missing local profile `What should I call you?`, save the answer locally before asking about a cloud account, and reuse it across resumed local and cloud flows. For local household creation, store a bounded `journal.household.display_name` using the deterministic possessive default. Add a revision-checked purpose-specific local household rename operation without replacing meal-planning state.
3. Add `hfj_update_user_display_name` as an idempotent account-scoped MCP mutation backed by the private user identity store. Require a valid authenticated principal and `journal:write`, bind exact retries to the same display name, make a retry after identity-write/response loss safe, and keep the name out of telemetry and mutation failure fields.
4. Add owner-only `hfj_update_household_name` with `expected_head` and an idempotency key. Commit only the rewritten `household.md` plus the standard audit event, update the operational display-name projection on success, parse the title during repository rebuild, and restore projection consistency after a crash between Git and Neon.
5. During existing-account setup or local cloud promotion, update the cloud display name from the remembered local profile. When there is no household and no pending family invitation to accept, create the first household with the possessive default. Do not rename an existing or joined household automatically.
6. Add a local MCP tool that stops only the fixed Fullwell WhatsApp LaunchAgent and removes its plist idempotently. Preserve the runner configuration, Keychain credentials, snapshots, receipts, remote device, WhatsApp link, and household data; explain that WhatsApp will remain unavailable until `fullwell-runner install` restarts it. Keep full disconnect/revocation separate.
7. Route explicit name and household-name changes to the applicable local and cloud mutations. A connected request updates both authorities with independent revision/idempotency guards and reports an exact partial result if either side fails; it never describes two separate mutations as atomic. Route `stop/remove my weekly meal reminder` to removal of the exact host-native `Fullwell weekly meal planning` task after listing and reconciliation; route `pause` to pause. Report runner and reminder success only from a confirmed result.
8. After successful cloud setup or promotion, mention inviting another person only for an owner when no pending invitation/import is being resumed. When the household has useful items and the current role can publish, mention a collection with one concrete example such as `Make a collection of five recipes we liked and give me a link.` Do not make either suggestion after failure, cancellation, a joined/viewer-only result, or when it would interrupt a pending intent.
9. Add deterministic local runtime, server mutation/recovery, contract, MCP metadata, package, and cross-host eval coverage. Update the normative specs, architecture/privacy/reliability guidance, changelogs, implementation log, package validation, and user-visible screencast evidence.

Feature-critic constraints:

- A local profile load remains the only action before the first question. The name is saved only after the user answers and is never inferred from an email, operating-system account, Apple relay address, household title, or retailer profile.
- A missing local profile does not mean a missing household. After learning the name, load existing local household state before deciding whether to initialize, resume, or use cloud authority.
- Display-name and household-name validation trims outer whitespace, rejects control characters and blank results, and applies the existing 120-character cloud limit. Possessive derivation operates only on the validated display name and never alters internal punctuation or Unicode letters.
- A cloud user-name update is account-scoped, requires mutation scope, and must not require or mutate a household. A cloud household-name update is owner-only and must not grant a viewer/editor broader authority.
- Household rename recovery must derive the name from `household.md`; updating only Neon would invert authority, while updating only Git would leave context and browser views stale.
- Local and cloud rename operations do not share a transaction. Exact results identify which authority changed, retain the failed side for a safe retry, and never roll back one successful rename by overwriting unrelated concurrent state.
- Runner stop targets only `com.fullwell.local-runner` in the current GUI user domain. It never accepts a label, path, command, PID, or shell fragment from the user and never turns a stop request into disconnect or data purge.
- The scheduled-task prompt remains identity-free. A conversational reminder removal reads and mutates host-native state only; it never writes the member or household name into Fullwell local/cloud state or task metadata.
- Invitation and collection copy is a suggestion, not permission to create, publish, or send anything. Collection publication still requires exact item preview, privacy review, and explicit confirmation.
- Rollback may ignore the separate local profile file and the additive `journal.household` field without corrupting the guest document. After a new cloud household rename commits, server rollback must retain a reader that accepts the unchanged `household.md` format.

Verification:

- `npm run test --workspace @hfj/contracts`
- `npm run test --workspace @hfj/server -- domain/repository-projection.test.ts services/household-food-journal.test.ts workers/reconciliation-worker.test.ts http/app.test.ts`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run typecheck`
- `npm run lint`
- `npm run test:e2e`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run capture:screencast -- --output artifacts/screencasts/name-first-household-controls.mp4`

### Milestone 12 - Web household rename and public naming guide

Files:

- `apps/server/src/http/web.ts`
- `apps/server/src/http/web-view-model.ts`
- `apps/server/src/http/app.test.ts`
- `apps/server/src/http/web-view-model.test.ts`
- `apps/server/src/main.ts`
- `apps/web/src/types.ts`
- `apps/web/src/context.tsx`
- `apps/web/src/fixtures.ts`
- `apps/web/src/components/household-name-editor.tsx`
- `apps/web/src/routes/household-overview.tsx`
- `apps/web/src/routes/guides.tsx`
- `apps/web/src/route.ts`
- `apps/web/src/server.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/test/app.test.tsx`
- `apps/web/src/test/route.test.ts`
- `tests/e2e/web.spec.ts`
- `tests/e2e/accessibility.spec.ts`
- `docs/product-specs/household-food-journal-client.md`
- `docs/product-specs/household-food-journal-server.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_LOG.md`
- `CHANGELOG.md`

Tasks:

1. Add the household repository HEAD to the private browser household summary and validate it at the React hydration boundary. Add a strict browser rename form containing the new name, exact expected HEAD, CSRF token, and idempotency key.
2. Authenticate the browser principal, verify CSRF, and delegate the POST to `hfj_update_household_name`. Preserve its owner-only scope and Git mutation/reconciliation behavior. Redirect a successful write to the refreshed household overview; return a private, human-readable retry page for stale revisions, invalid input, rate limits, and authorization changes.
3. Add a focused household-name editor beside the overview title. Reveal its pencil control on hover and focus for precise pointers, keep it visible on touch, prefill and select the current name in an autofocus dialog input, restore trigger focus after cancel, and preserve Escape/backdrop cancellation. Render a direct inline rename form inside `<noscript>`.
4. Add `/guides/household-name` to the public guide index, router, metadata, and crawler allowlist. Explain the natural chat request and web hover/edit/dialog flow, that only owners can rename a connected cloud household, and that a connected chat rename reports local and cloud outcomes separately.
5. Extend route, view-model, React, accessibility, and browser tests for owner success, exact replay, stale HEAD, invalid CSRF/name, editor denial, hidden/revealed/touch-equivalent control, autofocus and text selection, cancellation/focus restoration, no-JavaScript fallback, guide crawlability, and updated title after redirect. Update normative specs, architecture, changelog, and implementation log.

Feature-critic constraints:

- The hover treatment is visual polish, not the accessibility mechanism. The button remains in the focus order, appears on `:focus-within`, and is visible without hover on touch or coarse pointers.
- Only an owner sees the web edit affordance. The server independently authenticates, verifies CSRF, requires `household:manage`, and checks current owner membership so a forged editor or viewer POST fails.
- The form carries the repository HEAD that produced the visible title. A stale page fails with a plain-language refresh-and-retry response; it never substitutes a fresh HEAD and silently overwrites another rename.
- The input reuses the contract's trimmed, bounded household-name schema. Blank, control-character, overlong, and extra form fields fail before mutation.
- The dialog does not trap users after cancellation. Escape, backdrop, and Cancel close it, and the trigger regains focus. The current name is selected when the dialog opens so typing replaces it.
- JavaScript improves the interaction but is not mutation authority. The initial HTML contains the title, owner control, form fields, and a no-JavaScript submit path; the POST remains server-authoritative.
- The public guide contains no household data or mutation tokens. It describes both chat and web paths, owner authority, and conflict recovery in directly crawlable HTML.
- Rollback removes the browser POST, private summary revision, component, and additive guide route. Successfully committed household names remain valid because the durable format and mutation are unchanged.

Verification:

- `npm run test --workspace @hfj/server -- http/web-view-model.test.ts http/app.test.ts`
- `npm run test --workspace @hfj/web`
- `npm run typecheck`
- `npm run lint`
- `npm run test:e2e`
- `npm run build`
- `npm run verify`
- `npm run verify:docs`
- `npm run verify:execplan`
- `npm run capture:screencast -- --output artifacts/screencasts/web-household-rename.mp4`

## Interfaces and Dependencies

The public input is conceptually:

```ts
type OnboardingOutcome =
  | { section: "snacks" | "recipes"; outcome: "complete"; expected_revision: number }
  | { section: "snacks" | "recipes"; outcome: "skip"; reason: "not_now" | "no_sources" | "user_declined"; expected_revision: number };

interface CommitOnboardingInput {
  household_id: HouseholdId;
  expected_head: GitObjectId;
  idempotency_key: IdempotencyKey;
  sections: OnboardingOutcome[]; // unique by section; omit unchanged sections
  profiles: Array<{ profile: "snacks" | "recipes"; markdown: string }>;
  evidence: Evidence[];
  items: JournalItem[];
  reports: Report[];
  expected_item_revisions: Record<ItemId, GitObjectId>;
}
```

The exact schema uses unique section and profile lists so unchanged state is omitted while every persisted outcome remains explicit. `hfj_get_context` returns the stable authenticated user ID, one consistent HEAD, profile markdown/revisions, section revisions, and bounded item identity summaries needed to bind the local checkpoint and construct this request. If a section was already skipped and is declined again, the client omits it unless another canonical/profile change must be committed; a same-request canonical report makes it complete without an operational resume transition.

## Idempotence and Recovery

- The idempotency key binds to a stable fingerprint of the complete final payload. Changed reuse fails with `REVISION_CONFLICT` before any new write.
- The final tool writes all canonical files in one signed Git commit under the expected HEAD. Git path validation and append-only evidence rules remain unchanged.
- A skip-only request with no canonical changes compares the expected HEAD and section revisions, commits the skip rows plus completed idempotency response in one Neon household transaction, and records the unchanged HEAD as its replay anchor.
- The mutation record retains only the request fingerprint and bounded skip recovery intent, never raw source evidence or profile/report prose beyond what is canonical in Git.
- If Git succeeds but projections or skip compare-and-set fail, the request enters `reconciliation_required`. Exact retry or the reconciliation worker rebuilds Git projections and reapplies the bounded skip intent before completion.
- If the host loses the response after completion, exact retry returns the recorded response without another commit or onboarding transition.
- Local checkpoint writes compare a monotonically increasing draft revision and atomically replace a private file. Failed or uncertain remote writes retain the exact checkpoint and idempotency key; confirmed success and explicit cancellation delete only the matching current revision.
- The prior server and client remain compatible because existing tools are retained. Rollback disables the new client first, restores the previous server image second, and leaves any successfully committed canonical content valid.

## Acceptance / Verification

- On a fresh installation, the first user-facing question is `What should I call you?`; the confirmed answer is saved in private revisioned local profile state before the cloud-account question and is reused after restart.
- Connecting an existing cloud account or promoting a local household saves the remembered name as the cloud account display name. With no existing household and no pending household join, the first household is named `Name's Household`, or `Names' Household` when the validated name ends in `s` or `S`; existing and joined household titles remain unchanged.
- Ordinary chat can update the person's local profile name, the cloud account display name, the local household name, and an owner-authorized cloud household name with exact revision/idempotency behavior and no cross-authority success claim.
- An owner can rename a connected cloud household from the household overview with a hover/focus/touch-equivalent edit control and an autofocus, preselected name dialog. The same action remains available in ordinary chat; editors and viewers cannot see or forge the browser mutation.
- A stale browser rename, changed authorization, invalid CSRF token, or invalid name performs no Git write and returns a human-readable recovery path. JavaScript-disabled browsers retain a direct server-rendered form.
- `/guides/household-name` is public, crawlable, linked from `/guides`, and explains both chat and web naming paths without implying that local and cloud renames are atomic.
- An explicit chat request can stop the fixed local WhatsApp LaunchAgent while retaining connection data, and can remove the exact host-native weekly meal reminder. Fullwell reports success only after the relevant local control plane confirms the result.
- After a successful eligible cloud setup, the chat may suggest inviting another household member and making a collection with one concrete request example; it does not auto-invite, auto-publish, send, or show suggestions in inapplicable failure, pending-intent, or viewer-only states.
- After the name is remembered locally, a fresh installation's `@Fullwell hi` path asks whether the person already has a cloud account before any hosted Fullwell call. A negative answer initializes local household state and begins grocery then recipe questions without OAuth or hosted MCP; an affirmative answer uses the existing authenticated path.
- A remembered guest journal resumes locally without asking the cloud-account question again, and direct local restocking and recipe recall remain available after the person declines cloud backup.
- Cloud backup is offered only after local finalization. An accepted promotion authenticates, reconciles against one current hosted household, shows the exact copy/merge summary, and records a cloud link only after one confirmed successful commit; failure or uncertainty leaves the local journal authoritative.
- WhatsApp, collection sharing, invitations, and family access remain cloud-account-gated and explain the promotion path instead of treating local use as invalid.
- Successful local and hosted grocery onboarding asks the user to try one concrete out-of-stock restocking request, while unsuccessful or no-grocery completion does not imply the capability is ready.
- A fresh editable hosted household's path uses one `hfj_get_context` read, asks snack then recipe questions, and makes no Fullwell mutation before final confirmation.
- The client verifies payload bounds, shows a bounded summary of intended profile, evidence, report, and skip changes, and obtains explicit confirmation before the write.
- One `hfj_commit_onboarding` call persists the ordinary completed run and returns final derived section status without a follow-up read.
- One `hfj_commit_onboarding` call accepts as many as 10,000 items and 10,000 evidence records when the complete MCP envelope is at most 16 MiB; 10,001 records or an oversized body fails before mutation.
- A natural snack or recipe decline stays local during the conversation and is persisted as a bounded per-user skip only in the final call; an explicit whole-flow stop performs no write.
- A closed conversation resumes only a local draft matching the current authenticated user, household, repository HEAD, and both onboarding revisions; stale, malformed, expired, mismatched, and concurrently superseded drafts fail closed.
- Browser/source authorization remains explicit and separate from Fullwell tool approval.
- New evidence may support same-request item and report conclusions, but missing, duplicate, or arithmetically inconsistent evidence fails validation.
- Stale HEAD/item/onboarding revisions, changed idempotency payloads, viewers, cross-household substitution, truncated duplicate context, oversized payloads, and crash-after-commit recovery fail closed without duplicate Git commits or false completion.
- Current and previous clients remain compatible during rollout; tool annotations truthfully distinguish reads, ordinary writes, and destructive actions.
- Contract, server, reconciliation, load, security, eval, packaging, browser, integration, full verification, deployment smoke, and live current-host evidence pass.
- Screencast command: `npm run capture:screencast -- --output artifacts/screencasts/approval-efficient-onboarding.mp4`.

## Outcomes & Retrospective

Release commits `7fef31b` and `0a8ebcb` preserve the user's own display-name capitalization, greet a newly acquainted user warmly before asking about a cloud account, and use the name again only after a conversational lull. All account-facing package, site, guide, spec, test, and eval language now says cloud account where it distinguishes hosted identity from Fullwell's local no-account path. DigitalOcean runs healthy exact-source image `hfj-staging:personalized-icon-0a8ebcb-runtime`; schema `0008` readiness, deployment and MCP discovery smokes, warning logs, exact public icon metadata and hashes, operator health, and mounted-volume persistence pass with the prior deployment retained for rollback.

Milestone 12 reuses the existing owner-only `hfj_update_household_name` authority instead of creating a browser-only naming path. The authenticated overview now carries the Git HEAD that rendered the title, reveals a pencil control through hover, focus, or touch, and opens a native dialog with the current name focused and selected. Editors and viewers receive no control and cannot forge the POST; stale pages, invalid input, CSRF failures, and changed roles return private plain-language recovery without a write. The same server-rendered page retains a no-JavaScript form, while `/guides/household-name` gives logged-out visitors directly crawlable chat and website instructions. Browser, unit, eval, build, documentation, and ExecPlan gates pass; the macOS screencast helper remains unable to use its Linux-only `x11grab` input, so no MP4 is claimed.

Milestone 11 now makes an explicitly confirmed preferred name the first durable Fullwell state without inventing a guest household for an existing-account user. The same local profile supplies cloud display-name synchronization and a deterministic possessive first-household title, while existing, joined, and pending-intent households remain untouched. Purpose-specific local and cloud rename controls preserve independent revisions and report partial outcomes honestly; cloud household titles remain Git-authoritative and rebuild their Neon projection. Chat can stop only the fixed WhatsApp LaunchAgent, permanently remove the exact host-native weekly reminder, and offer eligible invitation or collection examples without treating copy as mutation authority. Public `@fullwell/fullwell@1.1.12` contains this behavior together with collaborative meal planning, the private recipe board, and optional weekly planning handoff; `latest` and the clean downloaded host lifecycles pass. No separate application deployment or screencast is claimed for the package release.

Public `@fullwell/fullwell@1.1.13` supersedes 1.1.12 with a Claude-compatible object-typed local household-update schema and the conversational `Hi Fullwell.` install handoff. Registry SHA-1 `a4fac97307fd48b72cc97677ea87e1972b5a640e` and SHA-512 `sha512-mOthMZdd5RUCnLwsqtlEnMiszNHQjf9omI6S1pCqu0rwmbT/Xmacim/5lJqa1BfBA2KlLR9rH+oVFKrXfsTrng==` byte-match the prepared 28-file artifact; clean downloaded Codex and Claude lifecycles pass, both current hosts resolve enabled 1.1.13, and Claude reports the local server as `Connected`. Staging runs the zero-production-vulnerability image `hfj-staging:claude-greeting-20260724-2-runtime` at OCI index digest `sha256:391c0c53023250d4894c11c224b7b24627795c55890c08d236b42bad15296e07`, built from archive SHA-256 `d8ee4be970f73d89bbb1f7174de3250ac0c9d21c1518e7ee7227f639cfb88502`; public deployment, MCP discovery, and install-greeting checks pass with the prior deployment environment retained for rollback.

Public `@fullwell/fullwell@1.1.10` corrects the live Claude startup failure without changing the stable `fullwell-local` server or tool identities. Codex retains its plugin-root working-directory adapter; Claude resolves the same server through `${CLAUDE_PLUGIN_ROOT}`; and the stdio main-module guard compares canonical filesystem paths so macOS `/tmp` and `/var` aliases do not cause a silent exit. Correction commit `ac4e231` is on `origin/main`; npm `latest` resolves to the checksum-matched 21-entry artifact; a clean registry install passes both host lifecycles; and current Codex and Claude are enabled on `1.1.10`, with Claude reporting the installed local server as `Connected`. No application-server deployment was necessary.

Public `@fullwell/fullwell@1.1.9` replaces direct execution of a versioned plugin-cache script with the plugin-provided `fullwell-local` MCP server. Its stable read-only load, non-destructive update, and collecting-only destructive deletion identities let a host retain narrowly scoped permission across compatible package upgrades while keeping cancellation separate. The server is dependency-free, offline, bounded, redacts unexpected failures, delegates journal validation to the existing runtime, and is discovered from isolated Codex and Claude installs. Implementation commit `cbc16c9` is on `origin/main`; npm `latest` resolves to the checksum-matched 20-entry artifact, and the downloaded package passes both isolated host lifecycles. No server deployment was necessary because the application runtime did not change.

The local implementation now provides one cloud-account-free guest household under the active Codex home, asks about an existing cloud account before any hosted call, resumes remembered guest state without re-asking, and supports grocery/recipe onboarding plus direct local use without OAuth. After local finalization it offers optional cloud backup for WhatsApp, sharing, and family access. Promotion is explicit, semantically reconciled, idempotent, and non-destructive: failure retains the local authority, success records the exact promoted revision, and later local edits make the marker stale instead of implying a backup that did not occur. Public package `@fullwell/fullwell@1.1.8` contains the same runtime and shared Codex/Claude instructions.

The authenticated implementation retains one lock-consistent `hfj_get_context` read, no intermediate Fullwell mutation, a user/household/snapshot-bound local checkpoint, one explicit final summary/confirmation, and one `hfj_commit_onboarding` write. Public `@fullwell/fullwell@1.1.7` carries the existing checkpoint and 10,000-item/10,000-evidence guidance for Codex and Claude, plus one-pass classification and restocking knowledge for snacks, ingredients, condiments, and other groceries. Skip-only confirmation leaves Git unchanged; canonical changes create one commit; exact replay does not create another commit; changed replay conflicts; post-Git skip failure is recovered from bounded metadata.

Local evidence for the published `1.1.5` baseline passes 279 deterministic tests with 11 database-gated skips, the 11 PostgreSQL integration tests separately through Apple Container, 29 browser tests with seven intentional project skips, 35 cross-host eval cases, eight package/lifecycle tests, migrations up/down/up, security/load/contract gates, the full repository verification, and 96.47% statement/line, 94.85% function, and 90.03% branch coverage. The prepared `1.1.6` correction independently bounds one onboarding request at 10,000 evidence records, 10,000 unique items, two reports, two profiles, two section outcomes, and a route-specific 16 MiB MCP body limit while retaining the one-megabyte default elsewhere. A 200-item snapshot truncation, stale state, ambiguity, or oversized draft may require additional approved reads; a draft within the final count and byte bounds must not be split into intermediate writes.

The `1.1.6` correction passes 284 deterministic tests with 11 expected database-gated skips, the focused contract/server/security/load suites, 29 browser tests with seven intentional project skips, 36 cross-host eval cases, and eight package/lifecycle tests. Its compact maximum-count service fixture commits and replays exactly once in about 0.6 seconds, and an isolated real Git repository stages and commits 20,000 paths without process argument expansion. Commits `b6b12db` and `785ec06` are pushed, and the production dependency audit reports zero vulnerabilities.

Staging now runs `hfj-staging:onboarding-capacity-20260722-2-runtime` with Linux/amd64 OCI index digest `sha256:87cc996a1c1d2666ccf1700cb9052655e24d937e1f1a6b8b3d9f9fafe21cad65` from checksum-matched archive SHA-256 `f433edbee1f69dde9e88017be9cfaae56bd94aaaf68e1654e5eeeb3cb2dcd898`. Public live/readiness, deployment, and OAuth/MCP discovery smokes pass at schema `0007`; a 1,100,070-byte live MCP request reaches authentication rather than the former one-megabyte parser rejection; and `hfj-staging:onboarding-drafts-20260722-1-runtime` plus the pre-release environment backup remain available for rollback.

Public immutable package `@fullwell/fullwell@1.1.6` has registry SHA-1 `1bb746d86d651176aa8cdab13ceff11e3655043d` and SHA-512 `sha512-P0tKysnAyMgycArCGRkk//4HNN83w7J7a5DPqtiaMFhwxLs8ixLtjksifZeqD+ZfInlANTInJlZB+7M0EZCtjA==`, matching the prepared 18-file artifact. `latest` resolves to `1.1.6`, a clean registry install passes isolated Codex and Claude lifecycles, and current Codex and Claude both report enabled `fullwell@fullwell` version `1.1.6`.

Whole-grocery release commit `681952e` is pushed. Staging runs `hfj-staging:whole-grocery-20260722-1-runtime` with Linux/amd64 OCI index digest `sha256:a18a9bdffeb4869d0e4c499755a1cfa4fe619c0137cf2e5df3895ae73fd5a641` from archive SHA-256 `44524cd4ef00b7d271c2110c598e341f3f8498cea9cdc783d03ab99d91616441`, while the prior capacity image remains available for rollback. Public `@fullwell/fullwell@1.1.7` has registry SHA-1 `8dadf6a576cc47adc8841bc3cb7aaa3f72ddac7b` and SHA-512 `sha512-pacGSP9DQCLJSm4EYIRNxw3zzIFh6VbdTfnDbWpBk1+m3vhdrhaeK2VoXsHkuaYJjdt+cCfvpsWjD60JRfgt8g==`; clean registry lifecycles pass and both current hosts report enabled version `1.1.7`.

Fresh `gpt-5.6-sol` sessions from the separate `fullwell-tester` folder prove the deployed response contains a stable user ID, a bounded checkpoint can be saved with zero Fullwell mutations, another conversation resumes the same marker and deletes the matching revision, and a final exact-shard load reports it missing. The transcript retains only booleans and mutation counts. A real final-confirmation write was intentionally not driven automatically because it would change the user's household based on invented onboarding answers; deterministic and PostgreSQL tests cover that atomic write. The required screencast was attempted and failed because the macOS FFmpeg build does not provide `x11grab`; no MP4 is claimed.

Local-first `1.1.8` acceptance passes seven guest-runtime tests, 44 cross-host eval cases, all 15 package/lifecycle tests, the package build, 289 deterministic application tests with 11 expected database skips, and 29 WebKit checks with seven intentional skips. Implementation commit `cade45e` is on `origin/main`. The public 19-entry registry artifact was published at `2026-07-23T01:54:54.598Z`; SHA-1 `f88bc7c0623a51956e9c5db2cea186a2d4dfeb0c` and SHA-512 `sha512-nPMvo7cw687woeAdO8V3hb31V7qUnzipa1quW4GdW6um9Vqu4gKfyrv80dWo2PR4ry8wWJgXuUAA02jvWv29Rg==` match the prepared artifact, and a clean downloaded install passes isolated Codex and Claude lifecycles. The completion handoff now invites an evidence-backed restocking request only after successful local finalization or hosted commit, explains the usual product/store lookup, and retains cart confirmation. The dedicated screencast attempt also failed on the helper's Linux-only `x11grab` input with code 234; browser e2e evidence is retained, but no MP4, host upgrade, or server deployment is claimed for `1.1.8`.
