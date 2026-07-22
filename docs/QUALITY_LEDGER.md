# Quality Ledger

Purpose: make structural quality and implementation debt explicit without awarding aspirational architecture credit before code exists.

Scoring scale:
- 5 = strong, exercised, and evidenced
- 4 = solid with minor gaps
- 3 = acceptable with notable debt
- 2 = fragile or mostly unproven
- 1 = absent or high risk

Last refreshed: 2026-07-21
Refresh owner: knowledge automation plus reviewer of affected changes

## Scorecard

- Architecture legibility: 4 - product, authority, adapter, and deployment boundaries are explicit and represented in the implementation; external staging proof remains incomplete.
- Boundary parsing and type discipline: 4 - strict TypeScript contracts and runtime schemas cover HTTP, MCP, Git, Meta webhook, runner archive/host, persistence, and migration boundaries; provisioned-provider verification remains incomplete.
- Test strength: 4 - the enforced deterministic coverage gate, contracts, dual-host evals, public-package Codex/Claude lifecycle tests, PostgreSQL integration, migrations, security fixtures, deterministic load/race, axe/WebKit accessibility, Git restore, and deployment smokes pass; provisioned load, manual accessibility, and external compatibility suites remain open.
- Reliability and observability: 4 - durable reconciliation, fail-closed readiness, operator health, redacted structured events, protected OpenMetrics, deployed encrypted/object-locked recovery, persisted verification/drill state, and deployment controls exist; combined Neon recovery and failover drills remain release blockers.
- Security hardening: 4 - trust boundaries, typed authorization, central telemetry redaction, capability projection, OAuth/passkey controls, per-route rate limits, final-owner enforcement, and the deterministic adversarial matrix pass; external staging and manual security review remain open.
- Documentation freshness: 4 - product, architecture, operations, release evidence, and the active ExecPlan reflect the implemented foundation and known blockers.
- Operational simplicity: 3 - one service, one writer, daily backup, and automatic monthly drill run on the staging deployment, but Droplet failover and combined Git-plus-Neon recovery remain unproven.

## Evidence

- `docs/product-specs/household-food-journal-server.md` and `docs/product-specs/household-food-journal-client.md` define normative acceptance behavior.
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, and `docs/RELIABILITY.md` define the target authorities and failure boundaries.
- Deterministic unit/component/load/security coverage passes with 279 tests at 96.47% statements/lines, 94.85% functions, and 90.03% branches; Neon integration adapters and process roots retain dedicated environment gates.
- Contract, 32-case Codex/Claude eval, isolated Codex CLI and Claude Code plugin lifecycle, live host OAuth revocation/reconnect, 11-test Apple Container PostgreSQL integration, seven-migration up/down/up, managed-Neon history evidence, account lifecycle, security-boundary, WebKit e2e, Git restore, local deployment, MCP discovery, OCI image, Caddy, Compose, and OpenTofu checks pass.
- Native Safari 26.5 Touch ID passkey enrollment and passkey-only sign-in pass against the provisioned DigitalOcean/Neon staging origin through Computer Use.
- Native Safari household creation plus the deployed Backblaze upload and isolated restore pass against the signed staging repository; Neon checkpoints and operator health confirm compliance retention, zero backup gaps, valid fsck/signatures, and a healthy restore drill.
- The public immutable `@fullwell/fullwell@1.0.0` registry artifact matches the prepared integrity and passes clean Node 24 installation plus isolated Codex and Claude lifecycle tests; the prior package name is deprecated with a rename notice, while the host plugin and MCP service retain the stable `household-food-journal` identifier.
- `apps/`, `packages/`, `migrations/`, `infra/`, and `deploy/` contain the coordinated React 19.2, Fastify, Neon, Git, agent-package, and DigitalOcean foundation.
- Direct WhatsApp transport, schema `0006`, the fixed-path runner snapshot, macOS Keychain/LaunchAgent lifecycle, Codex/Claude host adapters, closed-history restocking evals, fake-retailer WebKit tests, aggregate messaging operator metrics, and the dedicated Codex project/preflight are implemented. Encrypted provider credentials, publication, callback verification, the `messages` v25.0 subscription, one real signed inbound, and two-sided sender/device linking passed before every rollout gate was returned to disabled.
- Conversational Fullwell onboarding, schema `0007`, one-read/local-checkpoint drafting, atomic finalization, per-user skip recovery, report-derived completion, the 24-tool contract, and truthful MCP annotations pass focused server, dual-host package, and eval gates. The prepared client binds drafts to stable Fullwell user/household IDs plus the current snapshot, while public `@fullwell/fullwell@1.1.4` remains npm `latest` and the deployed server does not yet expose the new user ID field.

## Structural debt register

- DigitalOcean Block Storage failover fencing, production Neon 30-day history/scheduled snapshots, combined Git-plus-Neon RPO/RTO recovery, and provisioned staging rollback remain unproven. Live Backblaze Object Lock and isolated deployed Git recovery pass.
- Public npm installation, isolated Codex/Claude lifecycle behavior, and real host OAuth revocation/reconnect pass; public marketplace discovery plus setup, invitation, collection sharing, and selective-import workflows still need external compatibility evidence. Apple, email, and passkey authentication pass native Safari staging ceremonies.
- Manual VoiceOver, authenticated keyboard/zoom accessibility, iPhone hardware and non-Apple screen-reader coverage, provisioned load/soak and OAuth/import/Neon race coverage, privacy, secret-rotation, and manual release reviews remain no-go gates.
- Schema `0006`, the corrected image, HTTP/MCP smokes, encrypted Meta credentials, WhatsApp-aware unit, verified callback, subscribed `messages` v25.0 field, publication, a real provider-identity inbound, two-sided linking, maintenance, and operator health pass on staging. The keyring-backed isolated Codex host and exact-origin noninteractive fake-retailer quantity/replay proof also pass. Actual Claude fake-retailer control, one authorized no-checkout retailer proof, in-window reply/delivery/deduplication, and messaging rotation evidence remain blockers; all five rollout gates stay off.

## Maintenance rule

Do not increase a score because a plan or document exists. Change scores only when implementation and verification evidence materially justify it.
