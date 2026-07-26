BEGIN;

DELETE FROM search_items
WHERE kind = 'delivery_dish';

ALTER TABLE search_items
  DROP CONSTRAINT search_items_kind_check;

ALTER TABLE search_items
  ADD CONSTRAINT search_items_kind_check
  CHECK (kind IN (
    'snack',
    'ingredient',
    'condiment',
    'other_grocery',
    'recipe'
  ));

COMMIT;
