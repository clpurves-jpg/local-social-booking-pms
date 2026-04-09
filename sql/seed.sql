insert into inventory_units (name, slug, room_number, room_type, description, max_guests, bed_summary, flat_rate_display, base_rate, sort_order, cover_image_url)
values
('River Queen', 'river-queen', '1', 'Queen Room', 'Comfortable queen room with river-inspired styling.', 2, '1 Queen', 139.00, 125.00, 1, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'),
('Canyon King', 'canyon-king', '2', 'King Room', 'Spacious king room for couples or solo travelers wanting extra room.', 2, '1 King', 159.00, 144.00, 2, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'),
('Family Double', 'family-double', '3', 'Double Queen', 'Two queen beds and extra floor space for family stays.', 4, '2 Queens', 189.00, 170.00, 3, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'),
('Garden Suite', 'garden-suite', '4', 'Suite', 'Small suite feel with sitting area and softer finishes.', 3, '1 King + Sofa', 199.00, 180.00, 4, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'),
('Budget Queen', 'budget-queen', '5', 'Queen Room', 'Simple and clean room for value-focused guests.', 2, '1 Queen', 119.00, 107.00, 5, 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80'),
('Patio King', 'patio-king', '6', 'King Room', 'Ground-floor king room with patio access.', 2, '1 King', 169.00, 152.00, 6, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80')
on conflict (slug) do nothing;

-- Example future RV inventory row (disabled for now)
insert into inventory_units (name, slug, room_type, inventory_type_code, description, max_guests, bed_summary, flat_rate_display, base_rate, active, sort_order)
values ('RV Spot A', 'rv-spot-a', 'RV Spot', 'rv_spot', 'Future RV site inventory example.', 6, '30 amp / water', 55.00, 49.00, false, 100)
on conflict (slug) do nothing;
