# Changelog

## Unreleased

- Accept snack, ingredient, condiment, and other-grocery item areas plus current and legacy purchase evidence in the fixed restocking snapshot.
- Add the macOS local runner with OAuth PKCE, Keychain credentials, a secret-free LaunchAgent, a validated restocking-only snapshot cache, Codex and Claude Code host adapters, pre-action authorization, and idempotent local action receipts.
- Add fail-closed revocation, stale-HEAD recovery, host timeout and process-group cancellation, and unconditional local-data purge during disconnect.
- Use flat, typed structured-output objects accepted by the current Codex API and narrow them into the runner's result union at the adapter boundary.
- Preserve the non-secret Chrome backend marker in the LaunchAgent and host process, and require a non-null terminal message from Codex action turns.
- Require a dedicated Codex host project, use its separate `CODEX_HOME`, and fail closed unless `node_repl` is the only configured MCP server with the Browser and Chrome plugins enabled.
- Enroll the isolated Codex login in macOS Keychain, persist only the exact fake-retailer Browser Use origin, and pass the real noninteractive Codex quantity-one and duplicate-replay cart gate.
