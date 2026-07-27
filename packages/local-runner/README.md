# Fullwell Local Runner

The Fullwell local runner receives fixed-purpose restocking requests from the Fullwell gateway, refreshes and revalidates a read-only household grocery snapshot, serializes its allowlisted snack, ingredient, condiment, and other-grocery files into the trusted host prompt, and invokes Codex or Claude Code on the user's Mac without file, shell, or search tools. Product selection and retailer computer use happen locally. The gateway does not read the snapshot or choose products.

## Requirements

- macOS with Keychain and `launchd`;
- Node.js 24 installed through a stable path;
- Codex or Claude Code installed and signed in;
- a supported browser integration with access limited to one approved retailer origin;
- an existing Fullwell household and current `journal:read` plus `runner:messages` consent.

The runner never asks for a retailer password, MFA code, cookie, payment credential, Meta token, or Git credential. Sign into the retailer and approve browser/site permissions directly in the host application.

## Connect

Build the package, then connect one Mac to one household:

```sh
npm run build --workspace @fullwell/local-runner
fullwell-runner connect \
  --origin https://fullwell.ai \
  --household <household-id> \
  --host codex \
  --host-project "$HOME/Projects/fullwell-isolated-project-env" \
  --retailer https://<approved-retailer-origin>
fullwell-runner install
fullwell-runner status
```

`connect` opens the browser for OAuth with PKCE and then opens Account for the two-sided WhatsApp link. Tokens remain in macOS Keychain. `config.json` contains only non-secret identifiers, absolute executable and isolated-project paths, the public origin, and the approved retailer origin. The Codex runner rejects any effective MCP server other than `node_repl` and requires the Browser and Chrome plugins before each host invocation. Apps, hooks, shell, search, and user rules remain disabled. The installed LaunchAgent contains no secret and selects a stable Node 24 executable.

An installation connected to `fullwell.souschefstudio.com` must run `fullwell-runner disconnect` and reconnect with `--origin https://fullwell.ai`. OAuth grants and Keychain tokens are bound to the old resource and are not rewritten or accepted at the new origin.

The dedicated project isolates Codex configuration and action tools; it is not an operating-system account boundary. Its login must use macOS Keychain, and Browser Use must list only the approved exact origin in the isolated home's persistent `browser/config.toml`. A missing approval or capability drift returns a blocked result and must not be worked around with `never_ask` or a broad browser policy.

Use `--host claude` for Claude Code. Cowork Dispatch may be used manually as a separate Claude product surface, but Fullwell does not treat it as a supported inbound runner API.

## Operation

`fullwell-runner run` long-polls only while a message task is available; an empty poll does not invoke an agent. The runner downloads only the fixed restocking allowlist at an authorized Git HEAD, validates every path, file type, size, mode, and digest, and atomically swaps the local cache. Before any cart mutation it rechecks the runner grant, current membership, active WhatsApp link, and authoritative HEAD.

The compatibility snacks profile may contain one canonical `- Automatic cart-add maximum: USD N.NN` line. When absent, the maximum is `USD 50.00`; zero disables automatic additions. The runner reads this setting from the authoritative snapshot but never writes it. A complete requested USD item increment is added without another confirmation only when it is strictly below the maximum. An equal or greater amount requires request-scoped confirmation; missing or non-USD pricing blocks.

Version 2 local action receipts record an opaque request ID, selected historical item reference, retailer locator, baseline and target quantities, currency, incremental amount, effective maximum, authorization mode, host session ID, state, and bounded terminal message. A retry re-inspects quantity and price, aims for the recorded target instead of clicking again, and replays the exact verified completion without another mutation. Legacy unpriced unfinished receipts fail closed. The workflow can add to a cart, but cannot check out, pay, subscribe, accept a fee, alter unrelated cart items, or choose an internet-only substitute.

When the Mac is asleep, locked, offline, signed out of the host, blocked by CAPTCHA, or missing browser permission, the task waits or returns a bounded blocked result. A stale snapshot never authorizes a cart mutation.

## Local Data

Private cache and receipts live under `~/Library/Application Support/Fullwell/` with user-only permissions. OAuth refresh credentials live in Keychain. Logs must not contain message text, food or store names, cart contents, household titles, provider identifiers, or credentials.

## Disconnect

```sh
fullwell-runner disconnect
fullwell-runner uninstall
```

`disconnect` stops the LaunchAgent, attempts server-side device and OAuth revocation, and always purges local tokens, snapshots, action receipts, and config even if the server is unreachable. It does not delete or change the server-authoritative household Git repository. Account also provides a recent-auth, explicit `REVOKE` action that immediately prevents new claims and pre-action authorization.

## Cost Boundary

Fullwell uses direct Meta Cloud API integration and has no middleware message vendor. Local Codex or Claude work can consume the user's existing subscription or API allowance. WhatsApp intake and replies are compiled to stop before `2026-10-01T00:00:00-07:00`; re-enabling after that boundary requires a separate product decision and code change accepting a bounded paid-message policy.
