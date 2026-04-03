-- Create database
CREATE DATABASE finance_tracker;

-- Connect to database
\c finance_tracker;

-- Users table
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses table
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Incomes table (bi-monthly uses half_month: 1=1st half, 2=2nd half)
CREATE TABLE incomes (
    id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    month VARCHAR(255),
    type VARCHAR(20) NOT NULL DEFAULT 'monthly',
    year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    half_month INTEGER CHECK (half_month IN (1, 2)),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Budgets table (bi-monthly uses half_month: 1=1st half, 2=2nd half)
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

-- Create indexes
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_incomes_user_id ON incomes(user_id);
CREATE INDEX idx_incomes_type_year ON incomes(user_id, type, year);
CREATE INDEX idx_incomes_type_year_half ON incomes(user_id, type, year, half_month);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_type_year ON budgets(user_id, type, year);
CREATE INDEX idx_budgets_type_year_half ON budgets(user_id, type, year, half_month);