# Semantic Food Rules

Semantic judgments belong to the connected agent. Server and client code may validate structure and deterministic arithmetic, but must not classify foods, decide identity, merge variants, infer recipe status, or author report prose.

## Purchased groceries

During a grocery-history audit, classify every in-scope purchased identity as exactly one of `snack`, `ingredient`, `condiment`, or `other_grocery`. Classification is contextual and agent-authored; program code must not infer it from words in a title. Collapse only package-size or count differences for the same brand, product line, flavor, formulation, and format. Keep rows separate when brand, product line, flavor, formulation, format, or materially different produce variety differs.

- Golden and classic sandwich cookies are separate.
- Different sizes of the same branded Golden cookie may combine.
- Every cereal is a distinct pantry item.
- Cashews from different brands are separate.
- Red bean, taro, sesame, lotus, and custard buns are separate.
- Bars, pints, and drinks are separate formats.
- Red and green grapes are separate varieties.
- Fresh flat-leaf parsley and dried parsley are separate formats; a low-frequency fresh parsley purchase is still an ingredient item.
- Standard mayonnaise and Japanese-style mayonnaise are separate formulations. A request excluding the Japanese one must retain only supported non-Japanese historical candidates.

Count distinct `(store, order identifier)` pairs, never item quantities. Inspect every qualifying order and expand every item list once, collecting snacks, ingredients, condiments, and other groceries together. Preserve exact private line-item evidence and observed stores for every item. The recurrence threshold controls report rows only; retain an evidence-backed item below the threshold so future requests can still use its known product and source.

## Recipes

Ask which websites, bookmarking services, notes, communications, and other sources are authorized. For each website, establish whether the whole discoverable site or a subsection is in scope and what presence means: discoverable, saved, cooked, liked, or a user-defined status.

Append every occurrence, including duplicates and conflicts. Resolve identity in reasoning, not code. Keep Saved, Cooked, and Liked independent:

- discoverable alone establishes none of them;
- cooked does not imply liked;
- liked does not imply cooked;
- saved does not imply cooked or liked.

Record every supported cooking date and preparation change, distinguishing one-time changes from confirmed typical changes. Use an image displayed by the audited recipe site and preserve both page and image provenance.

## Meal proposals

Meal slots contain proposals, not a program-selected winner. Program code may validate dates, bounds, references, exact revisions, explicit Liked confirmation evidence, and append-only identity; it must not rank recipes, decide compatibility, infer a constraint, or overwrite one household member's idea with another's. The agent authors recommendation reasons and compatibility caveats from current evidence.

## Evidence and reports

Read current state before change. Append evidence before conclusions. Every report row cites exact item and evidence IDs; recurrence and last-date assertions must be deterministically supported. The agent authors the Markdown and explains uncertainty, conflicts, and limitations instead of inventing facts.
