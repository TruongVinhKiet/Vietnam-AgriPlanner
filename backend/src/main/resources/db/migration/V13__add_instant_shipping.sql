-- Add INSTANT shipping rate for testing (immediate delivery)
INSERT INTO shipping_rates (shipping_type, display_name, base_fee, fee_per_km, fee_per_kg, min_days, max_days, speed_km_per_day, is_active)
VALUES ('INSTANT', 'Giao ngay (Test)', 0, 0, 0, 0, 0, 99999, true)
ON CONFLICT (shipping_type) DO NOTHING;
