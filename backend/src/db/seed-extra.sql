-- Extra brighter catalog items (floor mats, side cabinets, etc.)

INSERT INTO catalog_items (room_id, category, name, description, style_id, base_price)
SELECT r.id, v.category, v.name, v.description, s.id, v.base_price
FROM (VALUES
  ('kitchen', 'cabinet_side', 'Side Cabinet (angled)', 'Right/left wall cabinet — rotate for corner angle', 'classic-wood', 55000),
  ('kitchen', 'upper_cabinet', 'Wall Hung Upper Cabinets', 'Upper storage cabinets', 'warm-walnut', 48000),
  ('kitchen', 'floor_mat', 'Kitchen Floor Mat (round)', 'Anti-fatigue round mat', 'modern-minimal', 2500),
  ('kitchen', 'floor_mat_rect', 'Kitchen Runner Mat', 'Rectangular kitchen runner', 'modern-minimal', 3200),
  ('kitchen', 'curtain', 'Window Curtain Set', 'Kitchen window curtains', 'classic-wood', 4500),
  ('hall', 'floor_mat', 'Living Rug (round)', 'Centre floor rug', 'modern-minimal', 8500),
  ('hall', 'floor_mat_rect', 'Living Runner', 'Hall runner carpet', 'warm-walnut', 6500),
  ('hall', 'curtain', 'Living Curtains', 'Window curtain pair', 'classic-wood', 7500),
  ('bedroom', 'floor_mat', 'Bedroom Rug', 'Bedside / centre rug', 'modern-minimal', 5500),
  ('bedroom', 'curtain', 'Bedroom Curtains', 'Window curtains', 'warm-walnut', 6000),
  ('porch', 'floor_mat_rect', 'Entrance Mat', 'Door mat / runner', 'classic-wood', 1800),
  ('terrace', 'floor_mat', 'Outdoor Round Mat', 'Terrace floor mat look', 'modern-minimal', 3500),
  ('toilet', 'floor_mat', 'Bath Mat', 'Bathroom floor mat', 'matte-grey', 1500)
) AS v(room_slug, category, name, description, style_slug, base_price)
JOIN rooms r ON r.slug = v.room_slug
JOIN styles s ON s.slug = v.style_slug
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items c
  WHERE c.room_id = r.id AND c.name = v.name
);
