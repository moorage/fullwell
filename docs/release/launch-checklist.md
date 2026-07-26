# Version 1 Launch Checklist

## Product and compatibility

- [ ] All server and client definitions of done pass with exact evidence.
- [ ] Codex and Claude manifests/catalogs are versioned together, point to identical skills/MCP URL, and pass official validators.
- [ ] Every row in `manual-matrix.md` is complete; unsupported surfaces are truthfully explained.
- [ ] Install, OAuth, setup, invite, grocery, recipe, collection, selective import, migration, export, revocation, leave, and deletion flows pass.
- [ ] Direct WhatsApp linking, signed inbound/retry, local Codex/Claude restocking, evidence-only ambiguity, idempotent no-checkout cart action, reply/delivery, offline, cutoff, revoke, and uninstall flows pass.
- [x] Provider-neutral fixture coverage passes for complete delivery indexing, provider/location ambiguity, household contribution, public-safe collections/import, local/cloud meal proposals, exact cart recovery, alcohol selection, and structural no-checkout behavior.
- [x] Food-delivery local hardening passes the full deterministic WebKit matrix, eight-migration PostgreSQL rollback/reapply, 11 database integrations, zero-production-vulnerability audit, pinned Node 24 image build, and fixture-only screencast.
- [ ] Authorized current DoorDash and Uber Eats matrices pass in supported Codex and Claude installed hosts; every advertised provider and alcohol sub-capability has an evidence-backed label.
- [ ] Upgrade, disable, re-enable, uninstall, and rollback preserve canonical data.

## Quality and safety

- [ ] Lint, typecheck, build, unit, contract, integration, security, eval, e2e, deploy smoke, docs, and ExecPlan gates pass.
- [x] Deterministic domain/adapter coverage meets the repository threshold; every LLM-involved semantic path has Codex and Claude eval evidence.
- [ ] Accessibility and privacy reviews are approved with no release-blocking finding.
- [ ] Cross-tenant, OAuth, CSRF, XSS/Markdown, prompt injection, Git/path, replay, rate-limit, redaction, race, and load suites pass.
- [ ] Privacy and Terms pages are no-JavaScript accessible and linked from install, sign-in, consent, collection, account, export, and deletion boundaries.
- [ ] Food-delivery privacy review proves provider consent/retention, public allowlists, telemetry redaction, user-controlled age/identity UI, and strict no checkout/payment/tip/address/schedule/membership/subscription authority.

## Operations

- [ ] OpenTofu plan, state controls, Droplet image/size, firewall, reserved IP, DNS, and volume identity are reviewed.
- [ ] Production app image and gateway are pinned by immutable digest; SBOM, vulnerability, provenance, and signature evidence is retained.
- [ ] Pooled/direct Neon separation, migrations, Apple, passkeys, Resend, OAuth/MCP discovery, and rate limits are production-verified.
- [ ] Encrypted credentials are least privilege; rotation/revocation/recovery drills pass without secret leakage.
- [ ] Git signing, fsck, signed manifest, off-site Object Lock backup, isolated restore, projection rebuild, and canary persistence pass.
- [ ] Single-writer failover and reserved-IP/volume movement are rehearsed with the old writer independently fenced.
- [ ] Alerts cover auth abuse, mutation failure, lock wait, conflict, reconciliation, projection mismatch, invalid repository/signature, backup age, restore drill, and volume capacity.
- [ ] Alerts cover messaging queue age/depth, lease churn, zero online runners with open work, cleanup/provider failures, expired service windows, and blocked paid sends without sensitive labels.
- [ ] Delivery rollout starts with live cart actions disabled; index/promotion, fixture cart, first live canary, and second provider advance independently with safe blocked/uncertain telemetry.
- [x] Delivery rollout and rollback sequencing is documented; cart no-checkout controls, ephemeral-plan recovery, and projection rollback are fixture-tested. Named-provider rollout stages remain disabled because live canary and rollback evidence is absent.

## Go and rollback

- [ ] Launch owner, incident commander, privacy/security contacts, support coverage, rollback digest, and decision window are recorded.
- [ ] Non-destructive staging canaries pass immediately before production.
- [ ] Delivery rollback disables cart mutation before provider indexing, revokes origins without claiming erasure, preserves additive Git history, and rebuilds/removes only noncanonical projections and active sessions.
- [ ] Production readiness is green before traffic; post-deploy install/auth/MCP/public-preview canaries use no real household data.
- [ ] A fresh backup completes after deployment and monitoring remains green through the observation window.
- [ ] Release notes, changelogs, implementation log, architecture/security/reliability docs, product specs, knowledge artifacts, and ExecPlan truthfully reflect the release.

Two authorized reviewers sign the production decision. Any unchecked blocking item is a no-go, not an accepted risk without a documented owner, expiry, and explicit approval.
