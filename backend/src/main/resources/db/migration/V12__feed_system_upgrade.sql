-- V12 Feed System Upgrade Migration
-- Complete feeding system with feed definitions, animal-feed compatibility, feeding schedules
-- NOTE: animal_definitions already exists with 36 records

-- =============================================
-- 1. FEED DEFINITIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS feed_definitions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- CONCENTRATE, ROUGHAGE, MIXED, AQUATIC, SPECIAL
    unit VARCHAR(20) DEFAULT 'kg',
    price_per_unit DECIMAL(15,2) NOT NULL, -- VND per unit
    protein_percent DECIMAL(5,2),
    description TEXT,
    storage_type VARCHAR(30), -- DRY, COOL, FROZEN
    shelf_life_days INT,
    icon_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- 2. ANIMAL-FEED COMPATIBILITY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS animal_feed_compatibility (
    id BIGSERIAL PRIMARY KEY,
    animal_definition_id BIGINT REFERENCES animal_definitions(id) ON DELETE CASCADE,
    feed_definition_id BIGINT REFERENCES feed_definitions(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    daily_amount_per_unit DECIMAL(10,3) NOT NULL,
    feeding_frequency INT DEFAULT 2,
    notes TEXT,
    UNIQUE(animal_definition_id, feed_definition_id)
);

-- =============================================
-- 3. EXTEND PENS TABLE FOR FEEDING TRACKING
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='pens' AND column_name='last_fed_at') THEN
        ALTER TABLE pens ADD COLUMN last_fed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='pens' AND column_name='next_feeding_at') THEN
        ALTER TABLE pens ADD COLUMN next_feeding_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='pens' AND column_name='feeding_status') THEN
        ALTER TABLE pens ADD COLUMN feeding_status VARCHAR(20) DEFAULT 'PENDING';
    END IF;
END$$;

-- =============================================
-- 4. EXTEND FEEDING_LOGS TABLE
-- =============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='feeding_logs' AND column_name='feed_definition_id') THEN
        ALTER TABLE feeding_logs ADD COLUMN feed_definition_id BIGINT REFERENCES feed_definitions(id);
    END IF;
END$$;

-- =============================================
-- 5. SEED FEED DEFINITIONS
-- =============================================
INSERT INTO feed_definitions (name, category, unit, price_per_unit, protein_percent, description, storage_type, shelf_life_days, icon_name) VALUES
('Cỏ voi', 'ROUGHAGE', 'kg', 2000, 8.0, 'Cỏ voi tươi cho trâu bò', 'COOL', 3, 'grass'),
('Cỏ tự nhiên', 'ROUGHAGE', 'kg', 1000, 6.0, 'Cỏ tự nhiên các loại', 'COOL', 2, 'grass'),
('Rơm khô', 'ROUGHAGE', 'kg', 1500, 4.0, 'Rơm lúa khô', 'DRY', 180, 'grass'),
('Cám bò vỗ béo', 'CONCENTRATE', 'kg', 12000, 14.0, 'Thức ăn tinh cho bò vỗ béo', 'DRY', 90, 'grain'),
('Bã bia', 'MIXED', 'kg', 3000, 25.0, 'Bã bia ướt, giàu protein', 'COOL', 2, 'local_bar'),
('Thức ăn bò sữa', 'CONCENTRATE', 'kg', 14000, 18.0, 'Cám cho bò sữa đang vắt', 'DRY', 90, 'grain'),
('Cám heo con', 'CONCENTRATE', 'kg', 18000, 22.0, 'Thức ăn dành cho heo con 7-30kg', 'DRY', 90, 'grain'),
('Cám heo thịt', 'CONCENTRATE', 'kg', 15000, 18.0, 'Thức ăn cho heo thịt 30-100kg', 'DRY', 90, 'grain'),
('Cám heo nái', 'CONCENTRATE', 'kg', 16000, 16.0, 'Thức ăn cho heo nái mang thai', 'DRY', 90, 'grain'),
('Lá cây các loại', 'ROUGHAGE', 'kg', 1500, 10.0, 'Lá mít, lá keo, lá so đũa...', 'COOL', 2, 'eco'),
('Cám dê', 'CONCENTRATE', 'kg', 11000, 16.0, 'Thức ăn tinh cho dê', 'DRY', 90, 'grain'),
('Cám cừu', 'CONCENTRATE', 'kg', 12000, 15.0, 'Thức ăn tinh cho cừu', 'DRY', 90, 'grain'),
('Cám gà con', 'CONCENTRATE', 'kg', 16000, 21.0, 'Thức ăn cho gà con 0-4 tuần', 'DRY', 60, 'grain'),
('Cám gà thịt', 'CONCENTRATE', 'kg', 14000, 19.0, 'Thức ăn cho gà thịt 4-12 tuần', 'DRY', 60, 'grain'),
('Cám gà đẻ', 'CONCENTRATE', 'kg', 13000, 17.0, 'Thức ăn cho gà đẻ trứng', 'DRY', 60, 'grain'),
('Cám cút con', 'CONCENTRATE', 'kg', 17000, 24.0, 'Thức ăn cho cút con', 'DRY', 60, 'grain'),
('Cám cút đẻ', 'CONCENTRATE', 'kg', 15000, 20.0, 'Thức ăn cho cút đẻ trứng', 'DRY', 60, 'grain'),
('Cám vịt con', 'CONCENTRATE', 'kg', 14000, 20.0, 'Thức ăn cho vịt con 0-3 tuần', 'DRY', 60, 'grain'),
('Cám vịt thịt', 'CONCENTRATE', 'kg', 12000, 17.0, 'Thức ăn cho vịt/ngan/ngỗng thịt', 'DRY', 60, 'grain'),
('Cám cá rô phi', 'AQUATIC', 'kg', 16000, 25.0, 'Thức ăn viên cho cá rô phi', 'DRY', 120, 'set_meal'),
('Cám cá trắm', 'AQUATIC', 'kg', 14000, 20.0, 'Thức ăn cho cá trắm cỏ', 'DRY', 120, 'set_meal'),
('Cám cá chép', 'AQUATIC', 'kg', 15000, 22.0, 'Thức ăn viên cho cá chép', 'DRY', 120, 'set_meal'),
('Cám cá tra/basa', 'AQUATIC', 'kg', 18000, 28.0, 'Thức ăn viên nổi cho cá tra', 'DRY', 120, 'set_meal'),
('Cám cá trê', 'AQUATIC', 'kg', 17000, 30.0, 'Thức ăn cho cá trê', 'DRY', 120, 'set_meal'),
('Cám cá lóc', 'AQUATIC', 'kg', 20000, 35.0, 'Thức ăn cho cá lóc', 'DRY', 120, 'set_meal'),
('Thức ăn lươn', 'AQUATIC', 'kg', 25000, 40.0, 'Thức ăn cao đạm cho lươn', 'DRY', 90, 'set_meal'),
('Thức ăn ếch', 'AQUATIC', 'kg', 22000, 38.0, 'Thức ăn cho ếch', 'DRY', 90, 'set_meal'),
('Cám cá mè', 'AQUATIC', 'kg', 13000, 18.0, 'Thức ăn cho cá mè', 'DRY', 120, 'set_meal'),
('Thức ăn ốc', 'AQUATIC', 'kg', 8000, 12.0, 'Thức ăn cho ốc bươu', 'DRY', 90, 'set_meal'),
('Thức ăn tôm sú', 'AQUATIC', 'kg', 45000, 40.0, 'Thức ăn cao cấp cho tôm sú', 'DRY', 90, 'set_meal'),
('Thức ăn tôm thẻ', 'AQUATIC', 'kg', 38000, 38.0, 'Thức ăn cho tôm thẻ chân trắng', 'DRY', 90, 'set_meal'),
('Thức ăn cua', 'AQUATIC', 'kg', 35000, 35.0, 'Thức ăn viên cho cua biển', 'DRY', 90, 'set_meal'),
('Cá tạp', 'AQUATIC', 'kg', 15000, 45.0, 'Cá tạp xay cho cua, tôm hùm', 'FROZEN', 30, 'set_meal'),
('Thức ăn cá kèo', 'AQUATIC', 'kg', 30000, 32.0, 'Thức ăn cho cá kèo', 'DRY', 90, 'set_meal'),
('Thức ăn cá đối', 'AQUATIC', 'kg', 25000, 28.0, 'Thức ăn cho cá đối', 'DRY', 90, 'set_meal'),
('Thức ăn cá mú', 'AQUATIC', 'kg', 50000, 45.0, 'Thức ăn cao cấp cho cá mú', 'DRY', 90, 'set_meal'),
('Thức ăn cá chim biển', 'AQUATIC', 'kg', 40000, 40.0, 'Thức ăn cho cá chim biển', 'DRY', 90, 'set_meal'),
('Thức ăn cá hồng', 'AQUATIC', 'kg', 38000, 38.0, 'Thức ăn cho cá hồng', 'DRY', 90, 'set_meal'),
('Thức ăn tôm hùm', 'AQUATIC', 'kg', 80000, 50.0, 'Thức ăn cao cấp cho tôm hùm', 'FROZEN', 60, 'set_meal'),
('Tảo/Phù du', 'AQUATIC', 'kg', 5000, 8.0, 'Thức ăn cho hàu, nghêu, sò', 'COOL', 1, 'water'),
('Siro đường', 'SPECIAL', 'lít', 25000, 0.0, 'Nước đường cho ong mùa khan', 'DRY', 30, 'water_drop'),
('Phấn hoa', 'SPECIAL', 'kg', 150000, 25.0, 'Phấn hoa cho ong', 'DRY', 365, 'local_florist'),
('Lá dâu tằm', 'SPECIAL', 'kg', 5000, 15.0, 'Lá dâu tươi cho tằm', 'COOL', 1, 'eco')
ON CONFLICT DO NOTHING;

-- =============================================
-- 6. SEED ANIMAL-FEED COMPATIBILITY
-- =============================================
-- TRÂU (id=1)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 1, id, TRUE, 30.0, 2, 'Cỏ voi - thức ăn chính' FROM feed_definitions WHERE name = 'Cỏ voi' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 1, id, FALSE, 3.0, 1, 'Cám bổ sung' FROM feed_definitions WHERE name = 'Cám bò vỗ béo' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 1, id, FALSE, 5.0, 1, 'Rơm khô bổ sung' FROM feed_definitions WHERE name = 'Rơm khô' ON CONFLICT DO NOTHING;

-- BÒ THỊT (id=2)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 2, id, TRUE, 25.0, 2, 'Cỏ voi - thức ăn chính' FROM feed_definitions WHERE name = 'Cỏ voi' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 2, id, FALSE, 4.0, 2, 'Cám bổ sung' FROM feed_definitions WHERE name = 'Cám bò vỗ béo' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 2, id, FALSE, 3.0, 1, 'Bã bia giàu protein' FROM feed_definitions WHERE name = 'Bã bia' ON CONFLICT DO NOTHING;

-- BÒ SỮA (id=3)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 3, id, TRUE, 30.0, 2, 'Cỏ voi - thức ăn chính' FROM feed_definitions WHERE name = 'Cỏ voi' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 3, id, FALSE, 6.0, 2, 'Cám bò sữa' FROM feed_definitions WHERE name = 'Thức ăn bò sữa' ON CONFLICT DO NOTHING;

-- LỢN/HEO (id=4)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 4, id, TRUE, 2.5, 2, 'Cám heo thịt' FROM feed_definitions WHERE name = 'Cám heo thịt' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 4, id, FALSE, 1.5, 2, 'Cho heo con' FROM feed_definitions WHERE name = 'Cám heo con' ON CONFLICT DO NOTHING;

-- DÊ (id=5)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 5, id, TRUE, 3.5, 2, 'Cỏ tự nhiên' FROM feed_definitions WHERE name = 'Cỏ tự nhiên' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 5, id, FALSE, 1.5, 2, 'Lá cây các loại' FROM feed_definitions WHERE name = 'Lá cây các loại' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 5, id, FALSE, 0.3, 1, 'Cám bổ sung' FROM feed_definitions WHERE name = 'Cám dê' ON CONFLICT DO NOTHING;

-- CỪU (id=6)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 6, id, TRUE, 3.0, 2, 'Cỏ tự nhiên' FROM feed_definitions WHERE name = 'Cỏ tự nhiên' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 6, id, FALSE, 0.4, 1, 'Cám bổ sung' FROM feed_definitions WHERE name = 'Cám cừu' ON CONFLICT DO NOTHING;

-- GÀ (id=7)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 7, id, TRUE, 0.12, 2, 'Cám gà thịt' FROM feed_definitions WHERE name = 'Cám gà thịt' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 7, id, FALSE, 0.05, 3, 'Cho gà con' FROM feed_definitions WHERE name = 'Cám gà con' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 7, id, FALSE, 0.11, 2, 'Cho gà đẻ' FROM feed_definitions WHERE name = 'Cám gà đẻ' ON CONFLICT DO NOTHING;

-- CHIM CÚT (id=8)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 8, id, TRUE, 0.025, 2, 'Cám cút đẻ' FROM feed_definitions WHERE name = 'Cám cút đẻ' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 8, id, FALSE, 0.015, 3, 'Cho cút con' FROM feed_definitions WHERE name = 'Cám cút con' ON CONFLICT DO NOTHING;

-- CÁ RÔ PHI (id=9)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 9, id, TRUE, 0.015, 3, '3% trọng lượng/ngày' FROM feed_definitions WHERE name = 'Cám cá rô phi' ON CONFLICT DO NOTHING;

-- CÁ TRẮM CỎ (id=10)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 10, id, TRUE, 0.05, 2, 'Cám cá trắm' FROM feed_definitions WHERE name = 'Cám cá trắm' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 10, id, FALSE, 0.1, 2, 'Cỏ tự nhiên' FROM feed_definitions WHERE name = 'Cỏ tự nhiên' ON CONFLICT DO NOTHING;

-- CÁ CHÉP (id=11)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 11, id, TRUE, 0.02, 2, 'Cám cá chép' FROM feed_definitions WHERE name = 'Cám cá chép' ON CONFLICT DO NOTHING;

-- CÁ MÈ (id=12)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 12, id, TRUE, 0.02, 2, 'Cám cá mè' FROM feed_definitions WHERE name = 'Cám cá mè' ON CONFLICT DO NOTHING;

-- CÁ TRÊ (id=13)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 13, id, TRUE, 0.015, 2, 'Cám cá trê' FROM feed_definitions WHERE name = 'Cám cá trê' ON CONFLICT DO NOTHING;

-- CÁ LÓC (id=14)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 14, id, TRUE, 0.03, 2, 'Cám cá lóc' FROM feed_definitions WHERE name = 'Cám cá lóc' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 14, id, FALSE, 0.05, 1, 'Cá tạp bổ sung' FROM feed_definitions WHERE name = 'Cá tạp' ON CONFLICT DO NOTHING;

-- CÁ TRA (id=15)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 15, id, TRUE, 0.03, 2, 'Cám cá tra' FROM feed_definitions WHERE name = 'Cám cá tra/basa' ON CONFLICT DO NOTHING;

-- CÁ BASA (id=16)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 16, id, TRUE, 0.03, 2, 'Cám cá basa' FROM feed_definitions WHERE name = 'Cám cá tra/basa' ON CONFLICT DO NOTHING;

-- LƯƠN (id=17)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 17, id, TRUE, 0.01, 2, 'Thức ăn lươn' FROM feed_definitions WHERE name = 'Thức ăn lươn' ON CONFLICT DO NOTHING;

-- ẾCH (id=18)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 18, id, TRUE, 0.01, 2, 'Thức ăn ếch' FROM feed_definitions WHERE name = 'Thức ăn ếch' ON CONFLICT DO NOTHING;

-- ỐC BƯƠU ĐEN (id=19)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 19, id, TRUE, 0.005, 1, 'Thức ăn ốc' FROM feed_definitions WHERE name = 'Thức ăn ốc' ON CONFLICT DO NOTHING;

-- TÔM SÚ (id=20)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 20, id, TRUE, 0.001, 4, 'Cho ăn 4 lần/ngày' FROM feed_definitions WHERE name = 'Thức ăn tôm sú' ON CONFLICT DO NOTHING;

-- TÔM THẺ CHÂN TRẮNG (id=21)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 21, id, TRUE, 0.0008, 4, 'Cho ăn 4 lần/ngày' FROM feed_definitions WHERE name = 'Thức ăn tôm thẻ' ON CONFLICT DO NOTHING;

-- CUA BIỂN (id=22)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 22, id, TRUE, 0.05, 2, 'Thức ăn cua' FROM feed_definitions WHERE name = 'Thức ăn cua' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 22, id, FALSE, 0.08, 1, 'Cá tạp bổ sung' FROM feed_definitions WHERE name = 'Cá tạp' ON CONFLICT DO NOTHING;

-- CÁ KÈO (id=23)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 23, id, TRUE, 0.005, 2, 'Thức ăn cá kèo' FROM feed_definitions WHERE name = 'Thức ăn cá kèo' ON CONFLICT DO NOTHING;

-- CÁ ĐỐI (id=24)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 24, id, TRUE, 0.01, 2, 'Thức ăn cá đối' FROM feed_definitions WHERE name = 'Thức ăn cá đối' ON CONFLICT DO NOTHING;

-- CÁ MÚ (id=25)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 25, id, TRUE, 0.05, 2, 'Thức ăn cá mú' FROM feed_definitions WHERE name = 'Thức ăn cá mú' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 25, id, FALSE, 0.08, 1, 'Cá tạp bổ sung' FROM feed_definitions WHERE name = 'Cá tạp' ON CONFLICT DO NOTHING;

-- CÁ CHIM BIỂN (id=26)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 26, id, TRUE, 0.03, 2, 'Thức ăn cá chim biển' FROM feed_definitions WHERE name = 'Thức ăn cá chim biển' ON CONFLICT DO NOTHING;

-- CÁ HỒNG (id=27)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 27, id, TRUE, 0.03, 2, 'Thức ăn cá hồng' FROM feed_definitions WHERE name = 'Thức ăn cá hồng' ON CONFLICT DO NOTHING;

-- TÔM HÙM (id=28)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 28, id, TRUE, 0.03, 2, 'Thức ăn tôm hùm' FROM feed_definitions WHERE name = 'Thức ăn tôm hùm' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 28, id, FALSE, 0.05, 1, 'Cá tạp bổ sung' FROM feed_definitions WHERE name = 'Cá tạp' ON CONFLICT DO NOTHING;

-- HÀU (id=29)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 29, id, TRUE, 0.001, 1, 'Tảo tự nhiên' FROM feed_definitions WHERE name = 'Tảo/Phù du' ON CONFLICT DO NOTHING;

-- NGHÊU (id=30)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 30, id, TRUE, 0.0005, 1, 'Tảo tự nhiên' FROM feed_definitions WHERE name = 'Tảo/Phù du' ON CONFLICT DO NOTHING;

-- SÒ (id=31)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 31, id, TRUE, 0.0005, 1, 'Tảo tự nhiên' FROM feed_definitions WHERE name = 'Tảo/Phù du' ON CONFLICT DO NOTHING;

-- VỊT (id=32)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 32, id, TRUE, 0.18, 2, 'Cám vịt thịt' FROM feed_definitions WHERE name = 'Cám vịt thịt' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 32, id, FALSE, 0.08, 3, 'Cho vịt con' FROM feed_definitions WHERE name = 'Cám vịt con' ON CONFLICT DO NOTHING;

-- NGAN (id=33)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 33, id, TRUE, 0.2, 2, 'Cám vịt/ngan thịt' FROM feed_definitions WHERE name = 'Cám vịt thịt' ON CONFLICT DO NOTHING;

-- NGỖNG (id=34)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 34, id, TRUE, 0.25, 2, 'Cám cho ngỗng' FROM feed_definitions WHERE name = 'Cám vịt thịt' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 34, id, FALSE, 0.3, 2, 'Cỏ tự nhiên' FROM feed_definitions WHERE name = 'Cỏ tự nhiên' ON CONFLICT DO NOTHING;

-- ONG (id=35)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 35, id, TRUE, 0.5, 1, 'Cho ăn khi khan mật' FROM feed_definitions WHERE name = 'Siro đường' ON CONFLICT DO NOTHING;
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 35, id, FALSE, 0.02, 1, 'Phấn hoa bổ sung' FROM feed_definitions WHERE name = 'Phấn hoa' ON CONFLICT DO NOTHING;

-- TẰM (id=36)
INSERT INTO animal_feed_compatibility (animal_definition_id, feed_definition_id, is_primary, daily_amount_per_unit, feeding_frequency, notes) SELECT 36, id, TRUE, 0.05, 4, 'Cho ăn 4 lần/ngày' FROM feed_definitions WHERE name = 'Lá dâu tằm' ON CONFLICT DO NOTHING;

-- =============================================
-- 7. CREATE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_feed_definitions_category ON feed_definitions(category);
CREATE INDEX IF NOT EXISTS idx_animal_feed_compat_animal ON animal_feed_compatibility(animal_definition_id);
CREATE INDEX IF NOT EXISTS idx_animal_feed_compat_feed ON animal_feed_compatibility(feed_definition_id);
CREATE INDEX IF NOT EXISTS idx_pens_feeding_status ON pens(feeding_status);
CREATE INDEX IF NOT EXISTS idx_pens_next_feeding ON pens(next_feeding_at);
