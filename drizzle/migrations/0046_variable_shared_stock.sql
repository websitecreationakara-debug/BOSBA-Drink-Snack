-- Variable products now share one stock pool on the product row instead of a
-- count per variation. Seed that pool from the existing variation stocks (sum of
-- the tracked ones; NULL = unlimited when none are tracked) so current counts
-- carry over. Variation stock columns are left in place but no longer read.
UPDATE products
SET stock = (
  SELECT SUM(v.stock)
  FROM product_variations v
  WHERE v.product_id = products.id AND v.stock IS NOT NULL
)
WHERE type = 'variable' AND stock IS NULL;
