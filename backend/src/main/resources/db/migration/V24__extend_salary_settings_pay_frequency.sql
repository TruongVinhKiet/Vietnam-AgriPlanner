ALTER TABLE salary_settings ADD COLUMN IF NOT EXISTS pay_frequency VARCHAR(20);

UPDATE salary_settings SET pay_frequency = 'MONTHLY' WHERE pay_frequency IS NULL;

ALTER TABLE salary_settings ALTER COLUMN pay_frequency SET DEFAULT 'MONTHLY';
ALTER TABLE salary_settings ALTER COLUMN pay_frequency SET NOT NULL;

ALTER TABLE salary_settings ADD COLUMN IF NOT EXISTS pay_day_of_week INTEGER;
