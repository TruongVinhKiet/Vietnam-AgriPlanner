-- Create Recruitment Posts Table
DROP TABLE IF EXISTS tasks;

CREATE TABLE IF NOT EXISTS recruitment_posts (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    quantity_needed INTEGER DEFAULT 1,
    salary_offer DECIMAL(15, 2),
    status VARCHAR(50) DEFAULT 'OPEN', -- OPEN, CLOSED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Job Applications Table
CREATE TABLE IF NOT EXISTS job_applications (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES recruitment_posts(id),
    worker_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, ACCEPTED, REJECTED
    message TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Tasks Table
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    farm_id BIGINT NOT NULL REFERENCES farms(id),
    owner_id BIGINT NOT NULL REFERENCES users(id),
    worker_id BIGINT REFERENCES users(id), -- Nullable if not yet assigned, but usually assigned immidately
    
    -- Task Context (Specific Field or Pen)
    field_id BIGINT REFERENCES fields(id),
    pen_id BIGINT REFERENCES pens(id),
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, APPROVED, CANCELLED
    priority VARCHAR(20) DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH
    
    -- New Columns for Smart Logic
    task_type VARCHAR(50), -- FEED, FERTILIZE, BUY_SUPPLIES, etc.
    related_item_id BIGINT REFERENCES shop_items(id), -- For Shop Items
    quantity_required DECIMAL(15, 2) DEFAULT 0,
    is_auto_created BOOLEAN DEFAULT FALSE,

    salary DECIMAL(15, 2) DEFAULT 0, -- Payment for this specific task if applicable
    
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_worker ON tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_tasks_farm ON tasks(farm_id);
CREATE INDEX IF NOT EXISTS idx_applications_worker ON job_applications(worker_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_farm ON recruitment_posts(farm_id);
