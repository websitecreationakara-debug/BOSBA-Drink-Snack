-- Variations share a stock count only within a "stock group": same flavor and,
-- for ml/L sizes, same size (see stockGroupKey in src/lib/commerce/variants.ts —
-- keep the two in sync). Every variation row stores its group's count, so merge
-- each group's tracked counts into one value (NULL = unlimited when none are
-- tracked), then roll the groups up onto products.stock for variable products.
CREATE TABLE _stock_groups AS
SELECT
  id,
  product_id,
  lower(trim(coalesce(flavor, ''))) || '|' ||
    CASE
      WHEN lower(replace(weight, ' ', '')) GLOB '*[0-9]ml'
        OR lower(replace(weight, ' ', '')) GLOB '*[0-9]cl'
        OR lower(replace(weight, ' ', '')) GLOB '*[0-9]l'
        OR lower(replace(weight, ' ', '')) GLOB '*[0-9]lt'
        OR lower(replace(weight, ' ', '')) GLOB '*[0-9]ltr'
        OR lower(replace(weight, ' ', '')) GLOB '*[0-9]liter'
        OR lower(replace(weight, ' ', '')) GLOB '*[0-9]litre'
      THEN lower(replace(weight, ' ', ''))
      ELSE ''
    END AS gk,
  stock
FROM product_variations;
--> statement-breakpoint
CREATE TABLE _stock_group_totals AS
SELECT product_id, gk, SUM(stock) AS total FROM _stock_groups GROUP BY product_id, gk;
--> statement-breakpoint
UPDATE product_variations
SET stock = (
  SELECT t.total
  FROM _stock_groups g
  JOIN _stock_group_totals t ON t.product_id = g.product_id AND t.gk = g.gk
  WHERE g.id = product_variations.id
);
--> statement-breakpoint
UPDATE products
SET stock = (
  CASE
    WHEN EXISTS (
      SELECT 1 FROM _stock_group_totals t WHERE t.product_id = products.id AND t.total IS NULL
    ) THEN NULL
    ELSE (SELECT SUM(t.total) FROM _stock_group_totals t WHERE t.product_id = products.id)
  END
)
WHERE type = 'variable';
--> statement-breakpoint
DROP TABLE _stock_group_totals;
--> statement-breakpoint
DROP TABLE _stock_groups;
