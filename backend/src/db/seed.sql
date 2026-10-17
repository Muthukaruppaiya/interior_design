-- Seed data for Interior Visualizer

INSERT INTO rooms (slug, name, description, icon, sort_order) VALUES
  ('hall', 'Hall / Living', 'Living room, TV wall, false ceiling', 'sofa', 1),
  ('kitchen', 'Kitchen', 'Modular kitchen and cabinets', 'kitchen', 2),
  ('bedroom', 'Bedroom', 'Wardrobe and bedroom units', 'bed', 3),
  ('toilet', 'Toilet / Bath', 'Vanity, tiles, mirrors', 'bath', 4),
  ('porch', 'Porch / Entrance', 'Shoe rack, seating, cladding', 'door', 5),
  ('terrace', 'Terrace', 'Outdoor seating and planters', 'sun', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO styles (slug, name, description, preview_color) VALUES
  ('modern-minimal', 'Modern Minimal', 'Clean lines, matte finishes', '#E8E6E1'),
  ('classic-wood', 'Classic Wood', 'Warm wood tones and traditional panels', '#8B5E3C'),
  ('matte-grey', 'Matte Grey', 'Contemporary grey laminates', '#6B7280'),
  ('warm-walnut', 'Warm Walnut', 'Rich walnut with soft lighting', '#5C4033')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO colors (name, hex_code, category)
SELECT v.name, v.hex_code, v.category
FROM (VALUES
  ('Off White', '#F5F2EB', 'paint'),
  ('Warm Beige', '#E8DCC8', 'paint'),
  ('Soft Grey', '#D1D5DB', 'paint'),
  ('Charcoal', '#374151', 'paint'),
  ('Walnut Brown', '#6B4423', 'laminate'),
  ('Oak Natural', '#C4A574', 'laminate'),
  ('Matte Black', '#1F2937', 'laminate'),
  ('Sage Green', '#9CAF88', 'accent')
) AS v(name, hex_code, category)
WHERE NOT EXISTS (
  SELECT 1 FROM colors c WHERE c.name = v.name AND c.hex_code = v.hex_code
);

-- Catalog items linked by room slug
INSERT INTO catalog_items (room_id, category, name, description, style_id, base_price)
SELECT r.id, v.category, v.name, v.description, s.id, v.base_price
FROM (VALUES
  ('hall', 'tv_unit', 'Floating TV Unit', 'Wall-mounted TV unit with drawers', 'modern-minimal', 45000),
  ('hall', 'tv_unit', 'Classic Panel TV Wall', 'Full-height panelled TV wall', 'classic-wood', 78000),
  ('hall', 'false_ceiling', 'Cove Light Ceiling', 'Gypsum false ceiling with cove lights', 'modern-minimal', 32000),
  ('hall', 'plant', 'Indoor Planter Set', 'Corner plant arrangement', 'modern-minimal', 4500),
  ('hall', 'fan', 'Designer Ceiling Fan', 'Premium decorative fan', 'matte-grey', 8500),
  ('hall', 'lighting', 'Wall Sconce Pair', 'Accent wall lights', 'warm-walnut', 6000),
  ('kitchen', 'cabinet', 'L-Shaped Modular Kitchen', 'Base + wall cabinets', 'modern-minimal', 185000),
  ('kitchen', 'cabinet', 'Parallel Modular Kitchen', 'Two-side kitchen layout', 'matte-grey', 165000),
  ('kitchen', 'chimney', 'Auto-clean Chimney', '90cm chimney unit', 'modern-minimal', 22000),
  ('kitchen', 'backsplash', 'Glass Backsplash', 'Coloured glass splashback', 'warm-walnut', 12000),
  ('bedroom', 'wardrobe', 'Sliding Wardrobe 6ft', 'Sliding door wardrobe', 'classic-wood', 95000),
  ('bedroom', 'wardrobe', 'Hinged Wardrobe 4ft', 'Hinged door wardrobe with loft', 'warm-walnut', 72000),
  ('bedroom', 'bed_panel', 'Upholstered Bed Back', 'Fabric bed back panel', 'modern-minimal', 28000),
  ('toilet', 'vanity', 'Wall-hung Vanity', 'Basin with storage cabinet', 'matte-grey', 35000),
  ('toilet', 'mirror', 'LED Mirror Cabinet', 'Mirror cabinet with LED', 'modern-minimal', 18000),
  ('porch', 'shoe_rack', 'Shoe Cabinet', 'Slim shoe rack with seat', 'classic-wood', 22000),
  ('porch', 'cladding', 'Feature Wall Cladding', 'Entrance feature panel', 'warm-walnut', 28000),
  ('terrace', 'seating', 'Outdoor Lounge Set', 'Weather-resistant seating look', 'modern-minimal', 45000),
  ('terrace', 'plant', 'Planter Wall', 'Vertical green wall concept', 'modern-minimal', 25000),
  ('terrace', 'pergola', 'Pergola Shade Concept', 'Shade structure visualization', 'classic-wood', 60000)
) AS v(room_slug, category, name, description, style_slug, base_price)
JOIN rooms r ON r.slug = v.room_slug
JOIN styles s ON s.slug = v.style_slug
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items c
  WHERE c.room_id = r.id AND c.name = v.name
);
