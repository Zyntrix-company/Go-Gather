-- Seed: initial amazing deals (migrated from hardcoded static data)
INSERT INTO deals (title, subtitle, image_url, hyperlink, sort_order, active) VALUES
  (
    'Taj Coral Reef, Maldives',
    'Overwater villas from ₹18,999/night',
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop',
    NULL, 1, true
  ),
  (
    'The Leela Goa',
    'Beachfront stay from ₹7,499/night',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop',
    NULL, 2, true
  ),
  (
    'Zostel Manali',
    'Hostel dorms from ₹599/night',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop',
    NULL, 3, true
  ),
  (
    'Goa Airport Cab',
    'AC sedan to North Goa — flat ₹699',
    'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&fit=crop',
    NULL, 4, true
  ),
  (
    'Manali Innova Crysta',
    'Hill station cab for 6 — ₹3,499/day',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop',
    NULL, 5, true
  ),
  (
    'Spiti Valley Trek',
    '7-day package from ₹14,999',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop',
    NULL, 6, true
  )
ON CONFLICT DO NOTHING;
