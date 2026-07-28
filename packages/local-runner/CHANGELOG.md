# Changelog

## Unreleased

- Support explicit Safari automation through Codex Computer Use while retaining Chrome through Browser Use, reject Safari with Claude Code, omit Chrome-only environment from Safari, and provide a fail-closed `set-browser` migration that preserves existing WhatsApp/device state.
- Replace a running LaunchAgent by booting out its exact plist definition before bootstrapping that same path, avoiding macOS launchd error 5 during reinstall.
- Add a strict, profile-configured automatic cart-add maximum with a `USD 50.00` default, request-scoped price confirmation at or above the maximum, pre-action price reinspection, versioned priced receipts, fail-closed legacy recovery, and exact completion-message replay.
- Accept snack, ingredient, condiment, and other-grocery item areas plus current and legacy purchase evidence in the fixed restocking snapshot.
- Add the macOS local runner with OAuth PKCE, Keychain credentials, a secret-free LaunchAgent, a validated restocking-only snapshot cache, Codex and Claude Code host adapters, pre-action authorization, and idempotent local action receipts.
- Add fail-closed revocation, stale-HEAD recovery, host timeout and process-group cancellation, and unconditional local-data purge during disconnect.
- Use flat, typed structured-output objects accepted by the current Codex API and narrow them into the runner's result union at the adapter boundary.
- Preserve the explicitly authorized non-secret Chrome backend marker only for Chrome, omit it for Safari, and require a non-null terminal message from Codex action turns.
- Require a dedicated Codex host project, use its separate `CODEX_HOME`, and fail closed unless `node_repl` is the only configured MCP server with exactly Computer Use for Safari or Browser plus Chrome for Chrome.
- Enroll the isolated Codex login in macOS Keychain, persist only the exact fake-retailer Browser Use origin, and pass the real noninteractive Codex quantity-one and duplicate-replay cart gate.
