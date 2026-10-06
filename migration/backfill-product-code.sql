WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM products
)
UPDATE products
SET product_code = 'BDS' || substr('000000' || (SELECT rn FROM ranked WHERE ranked.id = products.id), -6, 6)
WHERE product_code IS NULL;
