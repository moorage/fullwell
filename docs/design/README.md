# Household Food Journal Design

These artifacts are the implementation source of truth for the version 1 browser experience. They record the information architecture, user flows, screen states, content rules, visual system, and component inventory produced through the ChatGPT design pass. Automated WebKit and Safari/Computer Use review has exercised the implemented install and invalid-capability states; explicit product approval and the remaining authenticated states are still required before launch.

The browser is an administrative and handoff surface. It does not become a second journal editor: Codex and Claude collect evidence, resolve semantic food identity, and author journal content through the hosted service.

## Documents

- [Information architecture](information-architecture.md)
- [User flows](user-flows.md)
- [Screen-state matrix](screen-state-matrix.md)
- [Content style](content-style.md)
- [Visual system](visual-system.md)
- [Component inventory](component-inventory.md)

## Design acceptance

The design is accepted for implementation when every public and authenticated route:

- has a useful server-rendered state and an ordinary HTML form path;
- remains understandable at 320 CSS pixels and 200% zoom;
- preserves invitation or collection intent through sign-in;
- distinguishes household membership from collection import;
- describes roles and destructive actions before confirmation;
- avoids exposing Git, repository, OAuth, MCP, token, or commit terminology;
- links to privacy and terms at account, consent, install, invite, and collection boundaries.
