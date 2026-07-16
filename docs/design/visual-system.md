# Visual System

## Direction

The design borrows from a well-kept market ledger: crisp paper, dark ink, produce-label color, editorial headings, and efficient lists. It is neither a lifestyle landing page nor a generic SaaS dashboard. Food imagery appears only where it helps people recognize collection items.

## Tokens

| Role      | Value     | Use                                   |
| --------- | --------- | ------------------------------------- |
| Paper     | `#fbfaf6` | Page background                       |
| Surface   | `#ffffff` | Forms, selected rows, notices         |
| Ink       | `#1e2420` | Primary text                          |
| Muted ink | `#626a63` | Secondary text                        |
| Rule      | `#d8ddd6` | Borders and separators                |
| Leaf      | `#236245` | Primary action and success            |
| Tomato    | `#c9422f` | Destructive actions and urgent errors |
| Saffron   | `#e0a629` | Pending and attention states          |
| Sky       | `#d9ecf0` | Informational bands                   |

Spacing uses a 4-pixel base and larger steps of 8, 12, 16, 24, 32, 48, 64, and 96. Repeated item cards use a 6-pixel radius; controls use 4 or 6 pixels. The interface avoids nested cards and decorative shadows.

## Typography

- Display and section headings: `Iowan Old Style`, `Palatino Linotype`, or `Book Antiqua`.
- Interface and body: `Avenir Next`, `Avenir`, `Gill Sans`, or `Trebuchet MS`.
- Code/install commands: `SFMono-Regular`, `Consolas`, or `Liberation Mono`.
- Heading letter spacing is zero. Type never scales directly with viewport width.

The root body is 16 pixels with a 1.55 line height. Compact control text is 14-15 pixels. The largest heading is 52 pixels on wide screens and 38 pixels at small screens.

## Layout and motion

The content container tops out at 1160 pixels with 20-32 pixel gutters. Page intros are unframed. Data and action lists use rules, not floating section cards. A 160-millisecond opacity/translate reveal may orient a newly loaded page; reduced-motion removes it. Hover never moves layout.

## Focus and status

Every interactive element has a 3-pixel sky outline with a 2-pixel offset. Error, warning, success, and information notices include a meaningful heading and are not identified by color alone. Links remain underlined in prose.
