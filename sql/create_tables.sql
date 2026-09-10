-- Create database
CREATE DATABASE finance_tracker;

-- Connect to database
\c finance_tracker;

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    middle_name VARCHAR(255),
    last_name VARCHAR(255) NOT NULL,
    contact_no BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    avatar VARCHAR(255),
    reset_token VARCHAR(255),
    reset_token_expiry TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- EXPENSES TABLE
-- =============================================
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_account ON expenses(account_id);

-- =============================================
-- INCOMES TABLE (bi-monthly uses half_month: 1=1st half, 2=2nd half)
-- =============================================
CREATE TABLE incomes (
    id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    month VARCHAR(255),
    type VARCHAR(20) NOT NULL DEFAULT 'monthly',
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    half_month INTEGER CHECK (half_month IN (1, 2)),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER,
    note TEXT,
    category VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incomes_user_id ON incomes(user_id);
CREATE INDEX idx_incomes_type_year ON incomes(user_id, type, year);
CREATE INDEX idx_incomes_type_year_half ON incomes(user_id, type, year, half_month);
CREATE INDEX idx_incomes_account ON incomes(account_id);

-- =============================================
-- BUDGETS TABLE (bi-monthly uses half_month: 1=1st half, 2=2nd half)
-- =============================================
CREATE TABLE budgets (
    id SERIAL PRIMARY KEY,
    category VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    month VARCHAR(255),
    type VARCHAR(20) NOT NULL DEFAULT 'monthly',
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    half_month INTEGER CHECK (half_month IN (1, 2)),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_type_year ON budgets(user_id, type, year);
CREATE INDEX idx_budgets_type_year_half ON budgets(user_id, type, year, half_month);

-- =============================================
-- ACCOUNTS TABLE (NEW)
-- =============================================
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('cash', 'bank', 'e_wallet', 'credit_card', 'investment')),
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    color VARCHAR(7),
    icon VARCHAR(50),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- =============================================
-- ACCOUNT TRANSFERS TABLE (NEW)
-- =============================================
CREATE TABLE account_transfers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL,
    fee DECIMAL(15,2) DEFAULT 0,
    note VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (from_account_id != to_account_id),
    CHECK (amount > 0)
);

CREATE INDEX idx_transfers_user_id ON account_transfers(user_id);
CREATE INDEX idx_transfers_from_account ON account_transfers(from_account_id);
CREATE INDEX idx_transfers_to_account ON account_transfers(to_account_id);

-- =============================================
-- TAGS TABLE (NEW)
-- =============================================
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

CREATE INDEX idx_tags_user_id ON tags(user_id);

-- =============================================
-- TRANSACTION TAGS TABLE (NEW - Many-to-Many)
-- =============================================
CREATE TABLE transaction_tags (
    transaction_id INTEGER NOT NULL,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, transaction_type, tag_id)
);

-- =============================================
-- RECURRING TRANSACTIONS TABLE (NEW)
-- =============================================
CREATE TABLE recurring_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    amount DECIMAL(15,2) NOT NULL,
    category_id INTEGER,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    description VARCHAR(255),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE,
    next_execution DATE NOT NULL,
    execution_day INTEGER,
    auto_generate BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_days_before INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recurring_user_id ON recurring_transactions(user_id);
CREATE INDEX idx_recurring_next_exec ON recurring_transactions(next_execution);

-- =============================================
-- BILLS TABLE (NEW)
-- =============================================
CREATE TABLE bills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category_id INTEGER,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'yearly', 'one_time')),
    next_due_date DATE NOT NULL,
    is_subscription BOOLEAN NOT NULL DEFAULT FALSE,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    paid_date DATE,
    reminder_days INTEGER DEFAULT 3,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bills_user_id ON bills(user_id);
CREATE INDEX idx_bills_next_due ON bills(next_due_date);

-- =============================================
-- GOALS TABLE (NEW)
-- =============================================
CREATE TABLE goals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL,
    current_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    deadline DATE,
    category VARCHAR(50) DEFAULT 'other' CHECK (category IN ('emergency', 'investment', 'purchase', 'travel', 'other')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    image_url VARCHAR(255),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (target_amount > 0)
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_deadline ON goals(deadline);

-- =============================================
-- SAVINGS CONFIGS TABLE (NEW)
-- =============================================
CREATE TABLE savings_configs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('fixed_percentage', 'leftover_based', 'goal_based')),
    target_percentage DECIMAL(5,2),
    target_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    spending_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    min_balance DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_calculated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_savings_configs_user_id ON savings_configs(user_id);

-- =============================================
-- SAVINGS ALLOCATIONS TABLE (NEW)
-- =============================================
CREATE TABLE savings_allocations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    savings_config_id INTEGER NOT NULL REFERENCES savings_configs(id) ON DELETE CASCADE,
    goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'allocated', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_allocations_user_id ON savings_allocations(user_id);
CREATE INDEX idx_allocations_config_id ON savings_allocations(savings_config_id);
CREATE INDEX idx_allocations_goal_id ON savings_allocations(goal_id);

-- =============================================
-- AUTOMATION RULES TABLE (NEW)
-- =============================================
CREATE TABLE automation_rules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('transaction_added', 'balance_low', 'due_date', 'recurring_executed', 'periodic')),
    trigger_conditions JSONB NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('allocate_savings', 'send_notification', 'create_transaction', 'mark_paid')),
    action_params JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_automations_user_id ON automation_rules(user_id);
CREATE INDEX idx_automations_active ON automation_rules(is_active);

-- =============================================
-- NOTIFICATIONS TABLE (NEW)
-- =============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('budget_alert', 'bill_due', 'goal_progress', 'savings', 'insight', 'security')),
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    scheduled_for TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- =============================================
-- NOTIFICATION SETTINGS TABLE (NEW)
-- =============================================
CREATE TABLE user_notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    budget_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    bill_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    goal_updates BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_summary BOOLEAN NOT NULL DEFAULT TRUE,
    insights BOOLEAN NOT NULL DEFAULT TRUE,
    security_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INSIGHTS CACHE TABLE (NEW)
-- =============================================
CREATE TABLE insights_cache (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('overspending', 'savings_drop', 'burn_rate', 'category_alert', 'trend')),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    data JSONB,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, type, month, year)
);

CREATE INDEX idx_insights_user_id ON insights_cache(user_id);
CREATE INDEX idx_insights_period ON insights_cache(month, year);

-- =============================================
-- SESSIONS TABLE (NEW - Security)
-- =============================================
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    location VARCHAR(100),
    user_agent VARCHAR(500),
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);