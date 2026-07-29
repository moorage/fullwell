# Codex Chat Cloud OAuth Recovery

## Purpose / Big Picture

After a person explicitly removes the saved `fullwell-cloud` OAuth credential,
Codex Desktop still retains the installed plugin MCP configuration. On the next
app start, Codex attempts an unauthenticated MCP handshake, omits the failed
server from the model tool catalog, and therefore cannot use
`hfj_get_context` to start OAuth as the current client instructions promise.

This change makes an ordinary Fullwell conversation recover that state. After
the person has explicitly chosen the cloud path, the shared skill may use
Codex's fixed `codex mcp login fullwell-cloud` host command when the hosted tool
namespace is absent. Codex owns the browser callback and keyring credential.
Fullwell waits for completion, never reads or stores a token, and resumes
`hfj_get_context` on the next turn after Codex rebuilds the MCP binding. Claude
continues using its native protected-tool authentication path.

## Progress

- [x] 2026-07-29T18:50Z: Reproduced the post-restart omission and proved the
  saved credential had been removed by an earlier successful
  `codex mcp logout fullwell-cloud`.
- [x] 2026-07-29T19:05Z: Created and claimed Beads issue `fullwell-oxm`.
- [x] 2026-07-29T19:20Z: Inspected Codex 0.146.0 app-server schemas and current
  OpenAI Codex source for MCP OAuth, plugin install, runtime refresh, cached
  catalogs, and skill dependencies.
- [x] 2026-07-29T19:13Z: Added the bounded recovery contract to the skill, product specification,
  README, eval matrix, changelog, and implementation log.
- [x] 2026-07-29T19:15Z: Package validation, packaging tests, and eval tests
  passed. Full repository verification reached the ExecPlan documentation gate;
  this plan was then corrected to the required section names.
- [x] 2026-07-29T19:30Z: Installed the updated skill locally and verified
  thread `019faf56-9ad4-7f23-bab0-ff60888315b7` started Codex-owned OAuth
  without a user-entered terminal command; its next turn successfully called
  `fullwell-cloud.hfj_get_context`.
- [x] 2026-07-29T19:31Z: Full repository verification passed with 425
  application tests and 12 expected database-gated skips.
- [x] 2026-07-29T19:42Z: Prepared `@fullwell/fullwell@1.1.24`; package
  validation, the 53-test dual-host packaging suite, 14-test eval suite,
  zero-vulnerability production audit, and 34-file dry artifact passed.
- [x] 2026-07-29T19:43Z: Full verification passed with 425 application tests
  and 12 expected database-gated skips after correcting an unrelated
  empty-stdin child-process race exposed by the concurrent release gate.
- [x] 2026-07-29T19:50Z: Pushed release commit `51d6547`, deployed its exact
  Linux/amd64 server image with rollback retained, published the matching
  34-file `@fullwell/fullwell@1.1.24` artifact, and updated Codex and Claude.
- [x] 2026-07-29T19:54Z: Deliberately removed the Codex credential and proved
  normal Fullwell thread `019faf70-31c3-7eb2-a0d0-286d7bcacc79` invoked
  Codex-owned login; after browser consent, its next turn completed one
  read-only `fullwell-cloud.hfj_get_context` call and restored the credential.

## Surprises & Discoveries

- Restarting Codex did not remove the credential. A separate conversation
  successfully ran `codex mcp logout fullwell-cloud` at 11:39. The older
  process kept its authenticated client in memory until restart exposed the
  missing keyring entry.
- Codex app-server already exposes `mcpServer/oauth/login`, emits
  `mcpServer/oauthLogin/completed`, invalidates MCP runtimes after native login,
  and exposes `config/mcpServer/reload`, but none of these client-side protocol
  methods is available as an agent-callable chat tool.
- Codex starts plugin MCP OAuth during plugin installation, not when a later
  credential is removed.
- Skill MCP dependencies auto-install and authenticate only a missing server.
  They do not treat an installed but logged-out server as missing.
- Codex's tool-catalog cache can show schemas while startup is pending, but
  cached tools have no prepared client and cannot be called. It is not an auth
  bootstrap.
- Installed-host verification exposed a second failure: when Codex opens the
  authorization URL in a browser profile without a Fullwell web session,
  `GET /oauth/authorize` returned a bare `401` instead of preserving the OAuth
  request through Fullwell sign-in. Codex then waited until its callback
  expired.

## Expert Roundtable

### Expert panel

- Security researcher — preserves Codex's credential boundary and prevents a
  prompt or user value from becoming a shell argument.
- Product UX expert — keeps recovery conversational and avoids asking the
  person to copy a command or token.
- Staff integration engineer — distinguishes plugin, MCP, app-server, and
  per-turn tool-binding ownership.
- Reliability engineer — requires an awaited login result and an explicit
  next-turn continuation instead of claiming immediate tool availability.
- Agent evals engineer — covers the exact logged-out restart state and host
  divergence.

### What problem are we actually solving?

The problem is not OAuth discovery or server reachability. It is an installed
plugin whose host-owned credential was deliberately removed, leaving no remote
tool available for the model to call and no agent-callable Desktop auth RPC.

### Roundtable highlights

- Security: use one literal command only after explicit cloud intent; never
  accept a server name, scope, URL, or token from model-generated or user input.
- UX: say that Codex is opening Fullwell sign-in, wait for the browser result,
  and ask for one natural continuation message only when the host needs a new
  turn to rebuild tools.
- Architecture: keep the browser callback, token exchange, refresh token, and
  keyring entirely inside Codex; do not add network or keyring access to
  `fullwell-local`.
- Reliability: distinguish command failure, browser cancellation, command
  unavailability, and post-login tool refresh failure; never report connected
  before Codex reports success.
- Evals: add a Codex-specific case where config is installed, the credential is
  absent after restart, cloud intent is explicit, and the only permitted
  recovery is the fixed host command.

### Key tensions

- The shared skill must retain identical source for Codex and Claude while
  allowing a narrowly host-specific recovery branch.
- A user-requested logout must remain meaningful; recovery runs only after a
  later explicit choice to reconnect.
- Same-turn completion is desirable, but Codex freezes a turn's MCP binding.
  Correctness requires one follow-up turn rather than a false immediate retry.

### Synthesis for decomposition

- Update instructions and evals, not the local MCP runtime or hosted service.
- Preserve the explicit cloud-consent gate before any authentication action.
- Use the fixed Codex CLI command as a host bridge only when
  `hfj_get_context` is unavailable because the hosted namespace is absent.
- Await the command and surface ordinary-language failure without exposing raw
  OAuth errors.
- Resume hosted work only after a new binding exposes `hfj_get_context`.

## Decision Log

- 2026-07-29: Do not add a local `cloud_login` MCP tool. It would either spawn
  a host-specific subprocess from a cross-host data server or handle OAuth
  credentials outside Codex.
- 2026-07-29: Do not rely on skill dependency metadata. The server remains
  installed after `codex mcp logout`, so Codex's dependency installer does not
  run.
- 2026-07-29: Do not rely on cached tool schemas. Codex deliberately supplies
  no callable client for cached tools after failed startup.
- 2026-07-29: Use `codex mcp login fullwell-cloud` as the only recovery
  command. It is Codex's supported MCP OAuth entry point and accepts no
  user-controlled values in this flow.
- 2026-07-29: Redirect only an `AUTH_REQUIRED` browser authorization request
  to `/sign-in`, carrying the exact local request path as `returnTo`. Other
  authorization and server errors continue to fail explicitly.

## Failure-Oriented Critique

### Must fix before implementation

- **Security:** The draft could be misread as general shell fallback. Limit it
  to Codex, exact server identity, explicit cloud intent, and the literal
  command. Forbid substituted names, URLs, scopes, flags, or token handling.
- **Reliability:** A successful subprocess does not mutate the already frozen
  model binding. Require a next-turn continuation and call
  `hfj_get_context` before claiming the cloud is connected.
- **Privacy:** Raw OAuth failure text can include implementation details or an
  authorization URL. Summarize failure in ordinary language and never echo
  tokens, codes, callback parameters, or the raw command transcript.
- **Cross-host behavior:** Claude must not run the Codex command. Preserve its
  native protected-tool path explicitly.

### Should fix if low-cost

- Add a package assertion that the literal command appears exactly once in the
  managing skill and no generic `codex mcp login <value>` pattern is taught.
- Explain in the README that a prior explicit logout can require a one-message
  continuation after browser sign-in.

### Monitor during implementation

- Current Codex may rebuild the failed server on the next turn without a full
  app reload. The installed-host verification must prove this; otherwise the
  skill must ask for a plugin reload without claiming seamless continuation.

## Context and Orientation

`packages/agent-client/skills/manage-household-food-journal/SKILL.md` owns the
account-routing and cloud-promotion behavior. The Codex and Claude MCP adapters
are `packages/agent-client/codex-mcp.json` and
`packages/agent-client/.mcp.json`. The behavior matrix and structural checks
live in `packages/agent-client/evals/cases/v1.json`,
`packages/agent-client/tests/evals/matrix.test.mjs`, and
`packages/agent-client/scripts/validate-package.mjs`.

The client contract is
`docs/product-specs/household-food-journal-client.md`. Release-facing notes are
`packages/agent-client/CHANGELOG.md` and `docs/IMPLEMENTATION_LOG.md`.

## Milestones

### Milestone 1 — Define the bounded recovery contract

1. Amend the cloud-account and local-promotion instructions with one shared
   "hosted tool unavailable" recovery rule. Keep ordinary connected calls and
   Claude behavior unchanged.

Verification:

- `npm run build --workspace @fullwell/fullwell`

### Milestone 2 — Add regression evals and product documentation

2. Add one eval case and structural assertions for explicit consent, exact
   command, Codex-only routing, awaited completion, next-turn retry, and no
   token or generic shell behavior.
3. Update the product specification, README, changelog, and implementation log
   with the verified Codex limitation and bounded recovery.

Verification:

- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`

### Milestone 3 — Verify the installed Desktop behavior

4. Validate the package and repository, install the source package locally,
   then test a fresh Desktop conversation from the deliberately logged-out
   state.
5. Preserve an unauthenticated browser's exact OAuth request through Fullwell
   sign-in so the consent and loopback callback can complete.

Verification:

- `npm run verify`

### Milestone 4 — Release and deploy the verified recovery

6. Version the shared package as `1.1.24`, validate the immutable artifact, and
   push one atomic release commit.
7. Build and deploy the pushed commit as an immutable Linux/amd64 image. Retain
   the prior image and deployment environment as the rollback unit; no database
   migration, credential change, or household mutation is required.
8. Publish the prepared package, verify registry integrity from a clean
   download, update the configured Codex and Claude marketplaces, and update
   both installed plugins without changing the `fullwell-cloud` MCP identity or
   deleting its Codex-owned OAuth credential.
9. Verify public liveness/readiness, deployment and MCP discovery smokes, the
   anonymous OAuth sign-in redirect, installed package versions, and a fresh
   Codex chat `hfj_get_context` call.

Verification:

- `npm pack --dry-run --json --workspace @fullwell/fullwell`
- `npm run verify`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:deploy-smoke -- staging`
- `STAGING_BASE_URL=https://fullwell.ai npm run test:mcp-smoke -- staging`
- `npm view @fullwell/fullwell@1.1.24 --json`
- `codex plugin list --json`
- `claude plugin list --json`

Rollback:

- Before npm publication, automatically restore the preserved production image
  and environment if activation, liveness, or readiness fails.
- npm versions are immutable. If registry verification fails, keep the
  compatible server deployed and publish a higher patch only after diagnosis.

## Acceptance / Verification

- `npm run build --workspace @fullwell/fullwell`
- `npm run test:packaging --workspace @fullwell/fullwell`
- `npm run test:evals --workspace @fullwell/fullwell`
- `npm run verify`
- From no saved `fullwell-cloud` credential and a fresh Codex Desktop process,
  an explicitly cloud-authorized Fullwell chat runs the exact supported login
  command, opens the service-controlled browser, waits for Codex success, and
  exposes `hfj_get_context` on the next turn.
- A local-only answer never runs the command.
- Claude never runs the Codex command.
- No Fullwell runtime, local file, transcript assertion, or package content
  contains an OAuth token or browser credential.

## Outcomes & Retrospective

Release commit `51d6547` is pushed. Public `@fullwell/fullwell@1.1.24`
byte-matches the prepared and clean-download artifact at SHA-1
`a5152ed5fbd18876aca45c5f80d62dd6cdf818e8`. Codex and Claude both run the
enabled release, and Codex's installed managing skill byte-matches source.

DigitalOcean runs exact-source Linux/amd64 image
`hfj-staging:codex-oauth-51d6547-runtime` at OCI index
`sha256:d499d63d1e333a72c23efe2f043ebdedc30775c7eaa211c07746a6c7f079adb8`.
Public readiness, deployment/MCP smokes, exact anonymous OAuth redirect,
warning logs, maintenance, reconciliation, backup, repository, signature, and
quarantine checks pass. The prior image and environment retain rollback.

Fresh logged-out thread `019faf70-31c3-7eb2-a0d0-286d7bcacc79` triggered
`codex mcp login fullwell-cloud`, completed browser consent, and correctly
waited for a new turn. The resumed turn exposed and successfully called
`hfj_get_context`; Codex's keyring contains the restored host-owned credential.
No household was created or changed.

The first installed-host attempt also proved that a browser profile without a
Fullwell web session can strand OAuth at a bare `401`. The server source now
redirects that exact request through sign-in and has focused route coverage.
The deployed server now preserves that browser authorization request through
sign-in and returns to the original OAuth flow.

## Rollback

Revert the skill, eval, and documentation changes. No server schema, local
journal, OAuth grant, or credential format changes. A person can still remove
the Codex-owned grant with the existing host logout operation.
