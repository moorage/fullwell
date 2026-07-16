# Semantic Food Rules

Semantic judgments belong to the connected agent. Server and client code may validate structure and deterministic arithmetic, but must not classify foods, decide identity, merge variants, infer recipe status, or author report prose.

## Snacks and drinks

Collapse only package-size or count differences for the same brand, product line, flavor, formulation, and format. Keep rows separate when brand, product line, flavor, formulation, format, or materially different produce variety differs.

- Golden and classic sandwich cookies are separate.
- Different sizes of the same branded Golden cookie may combine.
- Every cereal is a distinct pantry item.
- Cashews from different brands are separate.
- Red bean, taro, sesame, lotus, and custard buns are separate.
- Bars, pints, and drinks are separate formats.
- Red and green grapes are separate varieties.

Count distinct `(store, order identifier)` pairs, never item quantities. Inspect every qualifying order and expand every item list before reporting recurrence. Preserve exact private line-item evidence for every conclusion.

## Recipes

Ask which websites, bookmarking services, notes, communications, and other sources are authorized. For each website, establish whether the whole discoverable site or a subsection is in scope and what presence means: discoverable, saved, cooked, liked, or a user-defined status.

Append every occurrence, including duplicates and conflicts. Resolve identity in reasoning, not code. Keep Saved, Cooked, and Liked independent:

- discoverable alone establishes none of them;
- cooked does not imply liked;
- liked does not imply cooked;
- saved does not imply cooked or liked.

Record every supported cooking date and preparation change, distinguishing one-time changes from confirmed typical changes. Use an image displayed by the audited recipe site and preserve both page and image provenance.

## Evidence and reports

Read current state before change. Append evidence before conclusions. Every report row cites exact item and evidence IDs; recurrence and last-date assertions must be deterministically supported. The agent authors the Markdown and explains uncertainty, conflicts, and limitations instead of inventing facts.
