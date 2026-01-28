CREATE TABLE IF NOT EXISTS task_work_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id BIGINT NOT NULL REFERENCES users(id),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_minutes INTEGER,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_work_logs_task ON task_work_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_work_logs_worker ON task_work_logs(worker_id);

CREATE TABLE IF NOT EXISTS salary_settings (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id),
    owner_id BIGINT NOT NULL REFERENCES users(id),
    worker_id BIGINT NOT NULL REFERENCES users(id),
    salary_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    pay_day_of_month INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    last_paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (farm_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_salary_settings_owner ON salary_settings(owner_id);
CREATE INDEX IF NOT EXISTS idx_salary_settings_worker ON salary_settings(worker_id);

CREATE TABLE IF NOT EXISTS salary_payments (
    id BIGSERIAL PRIMARY KEY,
    salary_setting_id BIGINT REFERENCES salary_settings(id),
    farm_id BIGINT NOT NULL REFERENCES farms(id),
    owner_id BIGINT NOT NULL REFERENCES users(id),
    worker_id BIGINT NOT NULL REFERENCES users(id),
    amount DECIMAL(15, 2) NOT NULL,
    pay_period_start DATE,
    pay_period_end DATE,
    status VARCHAR(20) DEFAULT 'PAID',
    description TEXT,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_worker ON salary_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_owner ON salary_payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_farm ON salary_payments(farm_id);

CREATE TABLE IF NOT EXISTS help_requests (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT REFERENCES farms(id),
    owner_id BIGINT NOT NULL REFERENCES users(id),
    worker_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN',
    owner_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_help_requests_worker ON help_requests(worker_id);
CREATE INDEX IF NOT EXISTS idx_help_requests_owner ON help_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_help_requests_status ON help_requests(status);
