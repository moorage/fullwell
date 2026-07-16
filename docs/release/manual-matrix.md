# Manual Compatibility Matrix

Status values: `Not run`, `Pass`, `Fail`, `Blocked`, or `Not available`. A release cannot pass with a required `Fail`, `Blocked`, or unexplained `Not available` result.

| Surface | Exact version/device | Install | OAuth | Setup | Invite | Share/revoke | Selective import | Upgrade/disable/uninstall | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Codex CLI | Record at run | Required | Required | Required | Required | Required | Required | Required | Link | Not run |
| ChatGPT desktop Codex | Record at run | When available | Required | Required | Required | Required | Required | Required | Link | Not run |
| Claude Code CLI | Record at run | Required | Required | Required | Required | Required | Required | Required | Link | Not run |
| Claude Cowork/Desktop | Record at run | When available | Required | Required | Required | Required | Required | Required | Link | Not run |
| Safari macOS | Record macOS/Safari | Install page | Auth browser | Required | Required | Required | Required | N/A | Link | Not run |
| Safari iPhone | Record iOS/Safari/device | Install page | Auth browser | Required | Required | Web Share and fallback | Required | N/A | Link | Not run |
| Firefox or Chrome | Record OS/browser | Install page | Auth browser | Required | Required | Fallback | Required | N/A | Link | Not run |

For every agent surface, test first install, reconnect, expired authorization, refresh rotation, grant revocation, upgrade, disable, re-enable, and uninstall. Verify canonical server data remains intact throughout. Confirm both hosts load the same five skill files, same 22 tool names, same MCP URL, and compatible errors.

For every browser, test 320x568, 390x844, 1024x768, and 1440x900 where applicable; keyboard-only flow; screen-reader labels; no-JavaScript invite/import baseline; expired/revoked capabilities; rate limit; conflict; focus recovery; and preservation of selected imports through sign-in and recoverable errors.

Evidence must record date, operator, exact version, sanitized screenshot or transcript location, result, defect link, and retest. Never capture a live invitation/share/magic-link token, email, household title, food name, or private evidence.
