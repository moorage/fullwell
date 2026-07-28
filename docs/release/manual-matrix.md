# Manual Compatibility Matrix

Status values: `Not run`, `Pass`, `Fail`, `Blocked`, or `Not available`. A release cannot pass with a required `Fail`, `Blocked`, or unexplained `Not available` result.

## Public Artwork Matrix

| Surface | Exact viewport/runtime | Artwork and layout evidence | Status |
|---|---|---|---|
| Desktop WebKit | 1440x900 | Full-body hero and face masthead visible; agent chooser remains in first viewport; no overflow | Pass |
| Mobile WebKit | iPhone 13 | Character is capped above the chooser; face masthead remains legible; no overflow | Pass |
| Narrow WebKit | 320x568 | Single-column hero, bounded artwork, readable install controls, and no horizontal overflow | Pass |
| No-JavaScript WebKit | 390x844 | Both static images render with the complete progressive install flow | Pass |
| Production HTTPS | fullwell.ai, 2026-07-27; 1440x900, iPhone 13, 320x568 WebKit | Exact PNG checksums/content types pass; full-body hero, face masthead, install controls, and no-overflow layout visually accepted | Pass |

| Surface | Exact version/device | Install | OAuth | Setup | Invite | Share/revoke | Selective import | Upgrade/disable/uninstall | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Codex CLI | 0.144.4 | Public npm artifact install/remove/reinstall pass | Dynamic registration, consent, token exchange, revoke/reconnect pass | Staging blocked | Staging blocked | Grant revoke pass; collection flow blocked | Staging blocked | Remove/reinstall pass; disable unavailable in CLI | `verification-evidence.md` | Blocked |
| ChatGPT desktop Codex | Record at run | When available | Required | Required | Required | Required | Required | Required | Link | Not run |
| Claude Code CLI | 2.1.215 live; 2.1.123 isolated lifecycle | Public npm artifact install pass | Dynamic registration, consent, token exchange, initialize, revoke/reconnect pass | Staging blocked | Staging blocked | Grant revoke pass; collection flow blocked | Staging blocked | Update/disable/re-enable/uninstall pass | `verification-evidence.md` | Blocked |
| Claude Cowork/Desktop | Record at run | When available | Required | Required | Required | Required | Required | Required | Link | Not run |
| Safari macOS | macOS 26.5.1 / Safari 26.5 | Keyboard + 200% pass | Apple, email, passkey, and agent consent pass | Household creation pass | Staging blocked | Agent grant revoke pass; collection flow blocked | Staging blocked | N/A | `verification-evidence.md` | Blocked |
| Safari iPhone | Record iOS/Safari/device | Install page | Auth browser | Required | Required | Web Share and fallback | Required | N/A | Link | Not run |
| Firefox or Chrome | Record OS/browser | Install page | Auth browser | Required | Required | Fallback | Required | N/A | Link | Not run |

## Canonical-Origin Migration Matrix

| Surface | Required transition | Evidence | Status |
|---|---|---|---|
| Apple web sign-in | Existing Fullwell Services ID registers the apex and legacy rollback callbacks; one real apex sign-in completes | Four website URLs saved and reloaded; real Apple passkey authorization returns to an authenticated reload-persistent apex session | Pass |
| Email and browser session | Fresh apex magic link creates an apex session; old-host session is not accepted | Local derivation passes; live run pending | Not run |
| Passkey | Apple/email bootstrap on the apex, then new passkey enrollment and passkey-only sign-in | Live run pending | Not run |
| Codex and Claude | Run public `@fullwell/fullwell@1.1.20`, retain `fullwell-local`, and authorize `fullwell-cloud` at `https://fullwell.ai/mcp` | Prepared and registry artifacts match; current Codex and Claude plugins are enabled on `1.1.20` with both MCP identities connected; setup, invite, share, and import rows remain blocking | Blocked |
| Local runner | Disconnect old-origin configuration and reconnect with `--origin https://fullwell.ai` | Deterministic docs/package checks pass; live reconnect pending | Not run |
| Meta WhatsApp webhook | Prove the direct apex transition route, save the apex callback, and receive a signed empty delivery before final redirect activation | Apex callback reloaded, mTLS off, only `messages` at v25.0; bounded signed smoke passes before and after activation | Pass |

## WhatsApp Restocking Matrix

| Surface | Exact version/device | Link | Signed inbound/retry | Historical ambiguity | Fake cart/idempotency | Revoke/offline | Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| Meta Cloud API | Approved WABA and connected Meta-provided virtual identity; Graph version pending credential setup | Account state implemented; live pending | Dedicated app/system user and least-privilege assets assigned; secure token, deployed callback, subscription, publication, and signed retry proof pending | N/A | N/A | Cutoff and revoke deterministic tests pass | `docs/design/whatsapp-local-restocking-feasibility.md` | Blocked |
| Codex local runner | CLI 0.144.6 / macOS 26.5.1 | OAuth/Keychain/LaunchAgent deterministic tests pass; isolated login uses Keychain | Gateway client deterministic tests pass | Shared evals pass | WebKit cart and actual noninteractive Browser Use quantity-one/replay pass at the exact fake origin | Purge/timeout/revision-conflict tests pass | `packages/local-runner/README.md` | Blocked pending staged message and real-retailer gates |
| Claude Code local runner | Record CLI/Chrome and macOS at run | OAuth/Keychain/LaunchAgent deterministic tests pass | Gateway client deterministic tests pass | Shared evals pass | Fake host protocol and WebKit cart pass; actual `--chrome` pending | Purge/timeout/revision-conflict tests pass | `packages/local-runner/README.md` | Blocked |
| Claude Cowork | Current supported product | N/A | No supported Fullwell inbound API proven | N/A | N/A | Use Dispatch manually only | `docs/design/whatsapp-local-restocking-feasibility.md` | Not available |

## Food-Delivery Matrix

Named providers remain examples until an authorized current installed-host run records an evidence-backed label. Fixture success must never be copied into a DoorDash, Uber Eats, or additional-provider claim.

| Provider/surface | Exact version/date | History index | Exact location/modifiers | Cart/recovery | Alcohol age step | No-checkout proof | Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| Provider-neutral fixture / WebKit | Repository fixture, 2026-07-26 | Complete/incomplete groups pass | Provider then location, quantities, and modifiers pass | Full-cart proof, preservation, replacement confirmation, and missing-delta recovery pass | Ordinary maximum and user-controlled pause pass | Checkout/payment/tip/address/schedule/membership/subscription controls are absent | `verification-evidence.md` | Pass |
| DoorDash / Codex and Claude | No authorized current run | Unsupported for release | Unsupported for release | Unsupported for release | Unsupported for release | Required before support | No live evidence | Blocked |
| Uber Eats / Codex and Claude | No authorized current run | Unsupported for release | Unsupported for release | Unsupported for release | Unsupported for release | Required before support | No live evidence | Blocked |
| Additional browser provider | No authorized current run; do not advertise | Unsupported for release | Unsupported for release | Unsupported for release | Unsupported for release | Required before support | No live evidence | Blocked |

For every agent surface, test first install, reconnect, expired authorization, refresh rotation, grant revocation, upgrade, disable, re-enable, and uninstall. Verify canonical server data remains intact throughout. Confirm both hosts load the same shared skill source, MCP URL, and compatible errors; the local runner adds the fixed restocking skill without expanding the server gateway into an agent.

For every browser, test 320x568, 390x844, 1024x768, and 1440x900 where applicable; keyboard-only flow; screen-reader labels; no-JavaScript invite/import baseline; expired/revoked capabilities; rate limit; conflict; focus recovery; and preservation of selected imports through sign-in and recoverable errors.

Evidence must record date, operator, exact version, sanitized screenshot or transcript location, result, defect link, and retest. Never capture a live invitation/share/magic-link token, email, household title, food name, or private evidence.
