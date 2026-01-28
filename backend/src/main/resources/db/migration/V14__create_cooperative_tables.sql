-- V14: Create Cooperative tables
-- Create cooperatives table
CREATE TABLE IF NOT EXISTS cooperatives (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    invite_code VARCHAR(10) UNIQUE,
    leader_id BIGINT REFERENCES users(id),
    description TEXT,
    address TEXT,
    phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PENDING',
    max_members INT DEFAULT 50,
    balance DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    approved_by BIGINT REFERENCES users(id)
);

-- Create cooperative members table
CREATE TABLE IF NOT EXISTS cooperative_members (
    id BIGSERIAL PRIMARY KEY,
    cooperative_id BIGINT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contribution DECIMAL(15,2) DEFAULT 0,
    UNIQUE(cooperative_id, user_id)
);

-- Create group buy campaigns table
CREATE TABLE IF NOT EXISTS group_buy_campaigns (
    id BIGSERIAL PRIMARY KEY,
    cooperative_id BIGINT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    shop_item_id BIGINT REFERENCES shop_items(id),
    title VARCHAR(255) NOT NULL,
    target_quantity INT NOT NULL,
    current_quantity INT DEFAULT 0,
    wholesale_price DECIMAL(15,2),
    retail_price DECIMAL(15,2),
    deadline TIMESTAMP,
    status VARCHAR(20) DEFAULT 'OPEN',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group buy contributions table
CREATE TABLE IF NOT EXISTS group_buy_contributions (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES group_buy_campaigns(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES cooperative_members(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    shipping_address_id BIGINT REFERENCES user_addresses(id),
    order_id BIGINT REFERENCES orders(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group sell campaigns table
CREATE TABLE IF NOT EXISTS group_sell_campaigns (
    id BIGSERIAL PRIMARY KEY,
    cooperative_id BIGINT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    target_quantity INT NOT NULL,
    current_quantity INT DEFAULT 0,
    min_price DECIMAL(15,2),
    unit VARCHAR(50),
    deadline TIMESTAMP,
    status VARCHAR(20) DEFAULT 'OPEN',
    buyer_info TEXT,
    final_price DECIMAL(15,2),
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create group sell contributions table
CREATE TABLE IF NOT EXISTS group_sell_contributions (
    id BIGSERIAL PRIMARY KEY,
    campaign_id BIGINT NOT NULL REFERENCES group_sell_campaigns(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES cooperative_members(id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cooperative transactions table
CREATE TABLE IF NOT EXISTS cooperative_transactions (
    id BIGSERIAL PRIMARY KEY,
    cooperative_id BIGINT NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES cooperative_members(id),
    type VARCHAR(20) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coop_status ON cooperatives(status);
CREATE INDEX IF NOT EXISTS idx_coop_invite_code ON cooperatives(invite_code);
CREATE INDEX IF NOT EXISTS idx_coop_members_user ON cooperative_members(user_id);
CREATE INDEX IF NOT EXISTS idx_coop_members_coop ON cooperative_members(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_coop ON group_buy_campaigns(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_group_buy_status ON group_buy_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_group_sell_coop ON group_sell_campaigns(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_coop_tx_coop ON cooperative_transactions(cooperative_id);
