-- Hand-maintained seafood seed (build-seed.mjs is OBSOLETE — its Supabase source is gone).
-- Idempotent-ish: clears app tables first. Apply with: npm run db:seed:local | db:seed:remote
DELETE FROM orders;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM store_settings;

INSERT INTO categories (id, name, slug, created_at) VALUES
  ('c1a00000-0000-4000-8000-000000000001', 'Sashimi & Sushi Grade', 'sashimi', '2026-06-04T00:00:00.000Z'),
  ('c1a00000-0000-4000-8000-000000000002', 'Fresh Fish & Fillets', 'fish', '2026-06-04T00:00:00.000Z'),
  ('c1a00000-0000-4000-8000-000000000003', 'Shellfish & Crab', 'shellfish', '2026-06-04T00:00:00.000Z'),
  ('c1a00000-0000-4000-8000-000000000004', 'Roe & Caviar', 'roe', '2026-06-04T00:00:00.000Z'),
  ('c1a00000-0000-4000-8000-000000000005', 'Uni & Delicacies', 'uni', '2026-06-04T00:00:00.000Z'),
  ('c1a00000-0000-4000-8000-000000000006', 'Prepared & Frozen', 'prepared', '2026-06-04T00:00:00.000Z');

INSERT INTO products (id, title, description, price, sale_price, category_id, stock, status, image_url, badge, rating, created_at, updated_at) VALUES
  ('p1000000-0000-4000-8000-000000000001', 'Bluefin Tuna Otoro', 'The prized fatty belly cut of bluefin — buttery, marbled, melts on the tongue. Sushi grade.', 48.0, NULL, 'c1a00000-0000-4000-8000-000000000001', 18, 'published', 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=600&q=80', 'HOT', 4.9, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000002', 'Sushi-Grade Salmon Block', 'Premium Atlantic salmon loin, trimmed and ready to slice for sashimi or nigiri.', 22.0, 18.5, 'c1a00000-0000-4000-8000-000000000001', 40, 'published', 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=600&q=80', 'SALE', 4.7, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000003', 'Yellowtail Hamachi Loin', 'Buttery Japanese amberjack with a clean finish — a sushi-counter favourite.', 26.0, NULL, 'c1a00000-0000-4000-8000-000000000001', 30, 'published', 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=600&q=80', 'NEW', 4.8, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000004', 'Whole Madai Sea Bream', 'Delicate, slightly sweet red sea bream. Sold whole, scaled and gutted.', 19.5, NULL, 'c1a00000-0000-4000-8000-000000000002', 22, 'published', 'https://images.unsplash.com/photo-1535140728325-a4d3707eee61?w=600&q=80', NULL, 4.6, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000005', 'Saba Mackerel Fillet', 'Rich, oily mackerel fillets — perfect grilled with salt or cured as shime-saba.', 9.5, 7.99, 'c1a00000-0000-4000-8000-000000000002', 60, 'published', 'https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?w=600&q=80', 'SALE', 4.5, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000006', 'Unagi Kabayaki Eel', 'Freshwater eel glazed and grilled in sweet tare sauce. Heat and serve over rice.', 16.0, NULL, 'c1a00000-0000-4000-8000-000000000002', 35, 'published', 'https://images.unsplash.com/photo-1607247098797-3f1c2c2b3f6e?w=600&q=80', 'HOT', 4.8, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000007', 'Hokkaido Scallops', 'Plump, sweet hotate scallops from cold northern waters. Sashimi grade, dry-packed.', 24.0, NULL, 'c1a00000-0000-4000-8000-000000000003', 45, 'published', 'https://images.unsplash.com/photo-1572441710534-8e8c92b6ce10?w=600&q=80', 'NEW', 4.8, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000008', 'Snow Crab Legs', 'Sweet, tender zuwaigani legs — pre-cooked and flash-frozen at sea.', 42.0, 36.0, 'c1a00000-0000-4000-8000-000000000003', 20, 'published', 'https://images.unsplash.com/photo-1550747545-c896b5f89ff7?w=600&q=80', 'SALE', 4.7, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000009', 'Amaebi Sweet Shrimp', 'Raw sweet shrimp with a delicate, almost creamy texture. Eaten as sashimi.', 18.0, NULL, 'c1a00000-0000-4000-8000-000000000003', 38, 'published', 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=600&q=80', NULL, 4.6, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000010', 'Ikura Salmon Roe', 'Glistening salmon roe cured in soy and dashi. Bursts with briny umami.', 20.0, NULL, 'c1a00000-0000-4000-8000-000000000004', 50, 'published', 'https://images.unsplash.com/photo-1611141652369-91d4d8d5c7e1?w=600&q=80', 'NEW', 4.9, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000011', 'Tobiko Flying Fish Roe', 'Tiny, crunchy flying-fish roe with a subtle smoky-sweet pop. Great for garnish.', 12.0, NULL, 'c1a00000-0000-4000-8000-000000000004', 55, 'published', 'https://images.unsplash.com/photo-1534482421-64566f976cfa?w=600&q=80', NULL, 4.5, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z'),
  ('p1000000-0000-4000-8000-000000000012', 'Bafun Uni Tray', 'Premium sea urchin from Hokkaido — rich, sweet, oceanic. Packed fresh on ice.', 55.0, NULL, 'c1a00000-0000-4000-8000-000000000005', 12, 'published', 'https://images.unsplash.com/photo-1606731115545-9c1f2b9b9e4c?w=600&q=80', 'HOT', 4.9, '2026-06-04T00:00:00.000Z', '2026-06-04T00:00:00.000Z');

INSERT INTO store_settings (id, banner_text, global_discount_pct, free_shipping_threshold, updated_at) VALUES
  ('bd607c32-b27f-48ef-9b23-29c34121bea9', 'Free chilled delivery on orders over $30', 0, 30, '2026-06-04T00:00:00.000Z');
