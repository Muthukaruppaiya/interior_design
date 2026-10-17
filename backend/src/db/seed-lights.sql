INSERT INTO catalog_items (room_id, category, name, description, style_id, base_price)
SELECT r.id, v.category, v.name, v.description, s.id, v.base_price
FROM (VALUES
  ('kitchen', 'glow_light', 'Warm Spot Glow', 'Ceiling spot with warm light glow', 'modern-minimal', 3500),
  ('kitchen', 'under_cabinet_light', 'Under-cabinet LED Strip', 'Adds warm glow under cabinets', 'modern-minimal', 4500),
  ('hall', 'glow_light', 'Living Spot Glow', 'Warm ambient spot light', 'warm-walnut', 3500),
  ('hall', 'under_cabinet_light', 'Cove Glow Strip', 'Soft cove / shelf lighting', 'modern-minimal', 5000),
  ('bedroom', 'glow_light', 'Bedroom Spot Glow', 'Warm bedside / ceiling glow', 'classic-wood', 3200)
) AS v(room_slug, category, name, description, style_slug, base_price)
JOIN rooms r ON r.slug = v.room_slug
JOIN styles s ON s.slug = v.style_slug
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items c
  WHERE c.room_id = r.id AND c.name = v.name
);
