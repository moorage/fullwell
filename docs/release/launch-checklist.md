# Version 1 Launch Checklist

## Product and compatibility

- [ ] All server and client definitions of done pass with exact evidence.
- [ ] Codex and Claude manifests/catalogs are versioned together, point to identical skills/MCP URL, and pass official validators.
- [ ] Every row in `manual-matrix.md` is complete; unsupported surfaces are truthfully explained.
- [ ] Install, OAuth, setup, invite, grocery, recipe, collection, selective import, migration, export, revocation, leave, and deletion flows pass.
- [ ] Upgrade, disable, re-enable, uninstall, and rollback preserve canonical data.

## Quality and safety

- [ ] Lint, typecheck, build, unit, contract, integration, security, eval, e2e, deploy smoke, docs, and ExecPlan gates pass.
- [ ] Deterministic domain/adapter coverage meets the repository threshold; every LLM-involved semantic path has Codex and Claude eval evidence.
- [ ] Accessibility and privacy reviews are approved with no release-blocking finding.
- [ ] Cross-tenant, OAuth, CSRF, XSS/Markdown, prompt injection, Git/path, replay, rate-limit, redaction, race, and load suites pass.
- [ ] Privacy and Terms pages are no-JavaScript accessible and linked from install, sign-in, consent, collection, account, export, and deletion boundaries.

## Operations

- [ ] OpenTofu plan, state controls, Droplet image/size, firewall, reserved IP, DNS, and volume identity are reviewed.
- [ ] Production app image and gateway are pinned by immutable digest; SBOM, vulnerability, provenance, and signature evidence is retained.
- [ ] Pooled/direct Neon separation, migrations, Apple, passkeys, Postmark, OAuth/MCP discovery, and rate limits are production-verified.
- [ ] Encrypted credentials are least privilege; rotation/revocation/recovery drills pass without secret leakage.
- [ ] Git signing, fsck, signed manifest, off-site Object Lock backup, isolated restore, projection rebuild, and canary persistence pass.
- [ ] Single-writer failover and reserved-IP/volume movement are rehearsed with the old writer independently fenced.
- [ ] Alerts cover auth abuse, mutation failure, lock wait, conflict, reconciliation, projection mismatch, invalid repository/signature, backup age, restore drill, and volume capacity.

## Go and rollback

- [ ] Launch owner, incident commander, privacy/security contacts, support coverage, rollback digest, and decision window are recorded.
- [ ] Non-destructive staging canaries pass immediately before production.
- [ ] Production readiness is green before traffic; post-deploy install/auth/MCP/public-preview canaries use no real household data.
- [ ] A fresh backup completes after deployment and monitoring remains green through the observation window.
- [ ] Release notes, changelogs, implementation log, architecture/security/reliability docs, product specs, knowledge artifacts, and ExecPlan truthfully reflect the release.

Two authorized reviewers sign the production decision. Any unchecked blocking item is a no-go, not an accepted risk without a documented owner, expiry, and explicit approval.
