# WhatsApp Local Restocking State Matrix

Date: 2026-07-20

## Account And Link States

| State | User surface | Allowed transition |
| --- | --- | --- |
| Disabled | Channel unavailable and cutoff shown | Code/config release only |
| Not configured | Install/connect runner | OAuth and device registration |
| Setup | Link WhatsApp to the named Mac | Create 10-minute browser-bound challenge |
| Pending confirmation | Return to the same Account session | Explicit browser confirmation |
| Expired | Link expired; start again | Revoke expired pending link, create new challenge |
| Linked | Named Mac and last heartbeat only | Revoke after recent auth and literal `REVOKE` |

The provider sender is not active until the link text arrives through a valid signed webhook and the same recent browser session confirms it. A sender, phone number, WABA ID, provider ID, token, message body, food name, or cart history is never shown on Account.

## Envelope States

| State | Meaning | Recovery |
| --- | --- | --- |
| `queued` | Encrypted inbound work is available to the one linked primary runner | Claim under an exclusive lease |
| `leased` | One device owns work for 90 seconds and may heartbeat | Expired lease returns to the same device queue; local receipt prevents duplicate cart increments |
| `response_ready` | Local terminal text is encrypted but not yet relayed | Send only inside an open pre-cutoff service window |
| `awaiting_user` | A historical ambiguity question was sent | Next linked inbound message resumes the same envelope/session |
| `completed` | Terminal response was accepted for provider delivery | Retain bounded encrypted/hashed metadata until cleanup |
| `expired` or `failed` | Work cannot continue safely | No cart mutation and no success-shaped reply |

Open capacity is eight envelopes per link and 1,000 globally. Provider message hashes deduplicate before capacity checks. Encrypted envelopes expire within seven days. Link challenges expire after ten minutes. Cleanup removes expired envelopes, delivery receipts, challenges, and unconfirmed links.

## Request Outcomes

| Condition | Result |
| --- | --- |
| One plausible historical product/store | Set target to current cart quantity plus requested quantity and add locally |
| Salted and unsalted are both plausible in household history | Ask one question using that historical distinction |
| Only salted appears in history but catalog offers unsalted | Do not ask about unsalted; catalog is availability evidence only |
| Revision, membership, grant, device, or link changes before action | Block and purge inaccessible local state |
| Cart equals recorded target after crash/retry | Report success without another increment |
| Cart exceeds recorded target | Block as uncertain; do not alter it |
| CAPTCHA, login, permission, cross-origin navigation, checkout, fee, subscription, or substitution | Block |
| Unsupported media/reaction/edit/call or invalid signature | Acknowledge or reject at the provider boundary without agent invocation |
| Service window expired or cutoff reached | Keep late result encrypted until a new allowed window or expiry; after cutoff enqueue/send nothing |

## Rollout Gates

Enable in order: `WHATSAPP_ENABLED`, webhook intake, linking, runner claims, service replies, then the separately local live-retailer permission. Every gate defaults off in deployment configuration. Roll back in reverse side-effect order: local live cart, replies, claims, linking, intake, provider webhook/token. Retain schema `0006` until link/device/envelope data is empty.
