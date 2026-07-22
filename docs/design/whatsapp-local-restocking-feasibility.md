# WhatsApp Local Restocking Feasibility

Date: 2026-07-20

## Decision

Proceed with a direct Meta Cloud API gateway and a local macOS runner. The server verifies, encrypts, queues, leases, and relays messages. It does not read household grocery files, run an LLM, choose a product or store, or control a retailer. Codex or Claude Code reads the authorized snack, ingredient, condiment, and other-grocery snapshot and controls only the configured retailer origin on the user's Mac.

No BSP, Twilio, or middleware messaging vendor is used. The connected Fullwell identity is a Meta-provided, platform-only virtual identity, not a PSTN or Google Voice number. Live WABA, phone-number, app, token, webhook, sender, household, device, and retailer identifiers remain outside Git.

## Proven Locally

- strict webhook verification and raw-body HMAC validation;
- bounded text and delivery-status parsing with unsupported-type accounting;
- encrypted, deduplicated, capacity-bounded queue and exclusive leases in memory and PostgreSQL;
- two-sided, same-browser sender linking plus device and membership revocation;
- a fixed restocking snapshot allowlist at one authoritative Git HEAD with traversal, mode, type, hash, and size validation;
- OAuth PKCE, Keychain storage, secret-free `launchd`, stable Node 24 selection, and unconditional cache purge;
- Codex and Claude Code host adapters with fixed prompts, structured output, `shell: false`, output limits, timeout, SIGTERM/SIGKILL, and no unattended permission bypass flag;
- closed-history preference rules, ambiguity evals, baseline-plus-one cart targets, and no-checkout boundaries;
- a deterministic fake retailer and WebKit cart behavior at desktop and mobile sizes;
- a hard pre-billing intake/reply cutoff at `2026-10-01T00:00:00-07:00` that configuration may move earlier but never later.

## External Evidence Still Required

- create the persistent Meta developer app/system-user credential and configure the HTTPS webhook after explicit user approval;
- prove one signed inbound message, provider retry, free reply, and delivery receipt on the connected account without recording message or sender content;
- run actual Codex desktop and Claude Code browser control against the fake retailer with interactive site/folder permissions;
- run one separately authorized real-retailer add-to-cart proof without checkout;
- deploy schema `0006`, run the staging messaging smoke, rotate the Meta token, and verify rollback/drain behavior;
- confirm the supported Graph API version shown by the Meta account at credential creation time.

## Pricing Control

Meta's public pricing material on 2026-07-20 describes a 24-hour service window and separately announced service-message billing effective 2026-10-01. Because the product requirement is zero paid messages and the public pages are not yet internally consistent, Fullwell does not rely on price classification at runtime. It disables intake, linking, claims, and replies before the announced boundary and exposes no template-send operation.

## Host Matrix

| Surface | Implementation status | Release status |
| --- | --- | --- |
| Codex desktop/CLI | Adapter, fixed prompt, structured protocol, timeout, and fake-host tests implemented | Browser/computer-use fixture proof pending |
| Claude Code | Adapter, JSON protocol, timeout, and fake-host tests implemented | `--chrome` fixture proof under LaunchAgent pending |
| Claude Cowork | No Fullwell inbound adapter | Unsupported until Anthropic publishes a stable inbound local-task API |
| Meta Cloud API | Direct adapter and signed webhook implemented | Persistent app/token/webhook configuration pending approval |
| Retailer | Local fake implemented | One real retailer requires separate explicit authorization |
