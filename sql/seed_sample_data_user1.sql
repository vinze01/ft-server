-- =====================================================================
-- Finance Tracker sample data (user_id = 1)
-- Run:  psql -U postgres -d finance_tracker -f seed_sample_data_user1.sql
-- Notes:
--   * Uses explicit ids 1-5 so rows link correctly. Delete conflicting
--     dev rows first if those ids are taken.
--   * user_notification_settings allows only ONE row per user, so it gets
--     1 row instead of 5.
-- =====================================================================

BEGIN;

-- ---------- ACCOUNTS (referenced by almost everything else) ----------
INSERT INTO accounts (id, user_id, name, type, balance, currency, color, icon, is_default, is_active) VALUES
(1, 1, 'Cash Wallet', 'cash', 15000.00, 'PHP', '#22c55e', 'cash', TRUE, TRUE),
(2, 1, 'BDO Savings', 'bank', 85000.00, 'PHP', '#3b82f6', 'bank', FALSE, TRUE),
(3, 1, 'GCash', 'e_wallet', 12000.50, 'PHP', '#0ea5e9', 'wallet', FALSE, TRUE),
(4, 1, 'BDO Credit Card', 'credit_card', 8200.00, 'PHP', '#ef4444', 'card', FALSE, TRUE),
(5, 1, 'Pag-IBIG MP2', 'investment', 50000.00, 'PHP', '#8b5cf6', 'chart', FALSE, TRUE);

-- ---------- EXPENSES ----------
INSERT INTO expenses (id, user_id, description, amount, category, date, account_id, note) VALUES
(1, 1, 'Jollibee lunch', 250.00, 'Food', '2026-09-02', 3, 'Lunch with team'),
(2, 1, 'Grab to office', 180.00, 'Transport', '2026-09-03', 3, NULL),
(3, 1, 'SM groceries', 3250.75, 'Shopping', '2026-09-04', 2, 'Weekly groceries'),
(4, 1, 'Meralco bill', 1985.40, 'Bills', '2026-09-05', 2, 'August billing'),
(5, 1, 'Movie night', 550.00, 'Entertainment', '2026-09-06', 1, 'SM Cinema');

-- ---------- INCOMES ----------
INSERT INTO incomes (id, user_id, amount, month, type, year, half_month, account_id, category, note) VALUES
(1, 1, 35000.00, 'September', 'monthly', 2026, NULL, 2, 'Salary', 'Monthly salary'),
(2, 1, 8000.00, 'September', 'bi-monthly', 2026, 1, 3, 'Freelance', 'First-half payout'),
(3, 1, 8000.00, 'September', 'bi-monthly', 2026, 2, 3, 'Freelance', 'Second-half payout'),
(4, 1, 420000.00, NULL, 'yearly', 2026, NULL, 2, 'Salary', 'Annual contract'),
(5, 1, 1500.00, 'September', 'monthly', 2026, NULL, 1, 'Allowance', 'Side hustle');

-- ---------- BUDGETS ----------
INSERT INTO budgets (id, user_id, category, amount, month, type, year, half_month) VALUES
(1, 1, 'Food', 6000.00, 'September', 'monthly', 2026, NULL),
(2, 1, 'Transport', 2500.00, 'September', 'monthly', 2026, NULL),
(3, 1, 'Shopping', 5000.00, 'September', 'bi-monthly', 2026, 1),
(4, 1, 'Bills', 8000.00, 'September', 'bi-monthly', 2026, 2),
(5, 1, 'Entertainment', 30000.00, NULL, 'yearly', 2026, NULL);

-- ---------- ACCOUNT TRANSFERS ----------
INSERT INTO account_transfers (id, user_id, from_account_id, to_account_id, amount, fee, note) VALUES
(1, 1, 2, 3, 5000.00, 0, 'Top up GCash'),
(2, 1, 2, 1, 3000.00, 0, 'ATM withdrawal'),
(3, 1, 3, 1, 1000.00, 15.00, 'Cash out with fee'),
(4, 1, 1, 5, 2000.00, 0, 'MP2 contribution'),
(5, 1, 2, 4, 8200.00, 0, 'Pay credit card');

-- ---------- TAGS ----------
INSERT INTO tags (id, user_id, name, color) VALUES
(1, 1, 'Groceries', '#22c55e'),
(2, 1, 'Dining', '#f97316'),
(3, 1, 'Transport', '#3b82f6'),
(4, 1, 'Utilities', '#eab308'),
(5, 1, 'Entertainment', '#ec4899');

-- ---------- TRANSACTION TAGS (links expenses above to tags) ----------
INSERT INTO transaction_tags (transaction_id, transaction_type, tag_id) VALUES
(3, 'expense', 1),
(1, 'expense', 2),
(2, 'expense', 3),
(4, 'expense', 4),
(5, 'expense', 5);

-- ---------- RECURRING TRANSACTIONS ----------
INSERT INTO recurring_transactions (id, user_id, type, amount, category_id, account_id, description, frequency, start_date, end_date, next_execution, execution_day, auto_generate, reminder_days_before, is_active, last_executed_at) VALUES
(1, 1, 'expense', 149.00, NULL, 4, 'Netflix', 'monthly', '2026-01-15', NULL, '2026-09-15', 15, TRUE, 3, TRUE, '2026-08-15 10:00:00'),
(2, 1, 'expense', 2500.00, NULL, 2, 'Rent', 'monthly', '2026-01-01', '2026-12-31', '2026-10-01', 1, TRUE, 5, TRUE, '2026-09-01 08:00:00'),
(3, 1, 'income', 35000.00, NULL, 2, 'Salary', 'monthly', '2026-01-30', NULL, '2026-09-30', 30, TRUE, 0, TRUE, '2026-08-30 09:00:00'),
(4, 1, 'expense', 500.00, NULL, 3, 'Gym', 'monthly', '2026-03-10', NULL, '2026-09-10', 10, FALSE, 1, TRUE, NULL),
(5, 1, 'expense', 1200.00, NULL, 2, 'Insurance', 'quarterly', '2026-01-05', NULL, '2026-10-05', 5, TRUE, 7, FALSE, '2026-07-05 08:00:00');

-- ---------- BILLS ----------
INSERT INTO bills (id, user_id, name, amount, category_id, account_id, due_day, frequency, next_due_date, is_subscription, is_paid, paid_date, reminder_days, notes) VALUES
(1, 1, 'Converge Internet', 1500.00, NULL, 4, 10, 'monthly', '2026-10-10', TRUE, FALSE, NULL, 3, 'Fiber plan'),
(2, 1, 'Meralco', 2000.00, NULL, 2, 20, 'monthly', '2026-09-20', FALSE, TRUE, '2026-09-18', 3, 'Paid early'),
(3, 1, 'Netflix', 549.00, NULL, 4, 15, 'monthly', '2026-10-15', TRUE, FALSE, NULL, 3, NULL),
(4, 1, 'Car Insurance', 15000.00, NULL, 2, 5, 'yearly', '2027-01-05', FALSE, FALSE, NULL, 14, 'Annual premium'),
(5, 1, 'Condo Dues', 3500.00, NULL, 2, 1, 'quarterly', '2026-10-01', FALSE, FALSE, NULL, 7, 'Q4 dues');

-- ---------- GOALS ----------
INSERT INTO goals (id, user_id, name, target_amount, current_amount, deadline, category, priority, image_url, is_completed, completed_at) VALUES
(1, 1, 'Emergency Fund', 100000.00, 45000.00, '2027-06-30', 'emergency', 'high', NULL, FALSE, NULL),
(2, 1, 'Japan Trip', 120000.00, 30000.00, '2027-03-15', 'travel', 'medium', NULL, FALSE, NULL),
(3, 1, 'New Laptop', 75000.00, 75000.00, '2026-08-31', 'purchase', 'medium', NULL, TRUE, '2026-08-28 12:00:00'),
(4, 1, 'Stock Investment', 50000.00, 12500.00, '2027-12-31', 'investment', 'low', NULL, FALSE, NULL),
(5, 1, 'Birthday Gift', 5000.00, 2000.00, '2026-10-20', 'purchase', 'low', NULL, FALSE, NULL);

-- ---------- SAVINGS CONFIGS ----------
INSERT INTO savings_configs (id, user_id, mode, target_percentage, target_account_id, spending_account_id, min_balance, is_active, last_calculated_at) VALUES
(1, 1, 'fixed_percentage', 10.00, 2, 1, 5000.00, TRUE, '2026-09-01 09:00:00'),
(2, 1, 'leftover_based', NULL, 2, 3, 3000.00, TRUE, NULL),
(3, 1, 'goal_based', NULL, 5, 1, 0.00, TRUE, NULL),
(4, 1, 'fixed_percentage', 20.00, 5, 2, 10000.00, FALSE, NULL),
(5, 1, 'leftover_based', NULL, 2, 1, 1000.00, FALSE, NULL);

-- ---------- SAVINGS ALLOCATIONS ----------
INSERT INTO savings_allocations (id, user_id, savings_config_id, goal_id, amount, period_start, period_end, status) VALUES
(1, 1, 1, 1, 3500.00, '2026-09-01', '2026-09-30', 'allocated'),
(2, 1, 3, 2, 4000.00, '2026-09-01', '2026-09-30', 'allocated'),
(3, 1, 3, 4, 1500.00, '2026-09-01', '2026-09-30', 'pending'),
(4, 1, 1, NULL, 2000.00, '2026-08-01', '2026-08-31', 'allocated'),
(5, 1, 2, 1, 1800.00, '2026-08-01', '2026-08-31', 'failed');

-- ---------- AUTOMATION RULES ----------
INSERT INTO automation_rules (id, user_id, name, description, trigger_type, trigger_conditions, action_type, action_params, is_active, execution_count, last_executed_at) VALUES
(1, 1, 'Low balance alert', 'Notify when total balance drops', 'balance_low', '{"value": 20000}'::jsonb, 'send_notification', '{"title": "Low balance", "message": "Balance below threshold"}'::jsonb, TRUE, 2, '2026-09-05 10:00:00'),
(2, 1, 'Monthly saver', 'Allocate savings every period', 'periodic', '{}'::jsonb, 'allocate_savings', '{"amount": 1000}'::jsonb, TRUE, 5, '2026-09-01 00:00:00'),
(3, 1, 'Big purchase watcher', 'Flag large expenses', 'transaction_added', '{"field": "amount", "operator": "gt", "value": 10000}'::jsonb, 'send_notification', '{"title": "Big expense", "message": "Large transaction detected"}'::jsonb, TRUE, 0, NULL),
(4, 1, 'Bill auto-pay', 'Mark bill paid on due date', 'due_date', '{}'::jsonb, 'mark_paid', '{"billId": 1}'::jsonb, FALSE, 1, '2026-08-10 00:00:00'),
(5, 1, 'Recurring logger', 'Log recurring income', 'recurring_executed', '{}'::jsonb, 'create_transaction', '{"description": "Auto income", "amount": 500, "category": "Other"}'::jsonb, FALSE, 0, NULL);

-- ---------- NOTIFICATIONS ----------
INSERT INTO notifications (id, user_id, type, title, message, data, is_read, read_at, scheduled_for) VALUES
(1, 1, 'bill_due', 'Meralco due soon', 'Your Meralco bill of PHP 2,000 is due on Sep 20', NULL, FALSE, NULL, NULL),
(2, 1, 'goal_progress', 'Emergency Fund at 45%', 'You saved PHP 45,000 of PHP 100,000', '{"goalId": 1}'::jsonb, FALSE, NULL, NULL),
(3, 1, 'budget_alert', 'Food budget 80% used', 'PHP 4,800 of PHP 6,000 spent', NULL, TRUE, '2026-09-06 18:00:00', NULL),
(4, 1, 'insight', 'Spending up 12%', 'Dining expenses rose this month', NULL, FALSE, NULL, NULL),
(5, 1, 'security', 'New login', 'Signed in from Chrome on Windows', NULL, TRUE, '2026-09-01 09:05:00', NULL);

-- ---------- NOTIFICATION SETTINGS (one row per user only) ----------
INSERT INTO user_notification_settings (id, user_id, budget_alerts, bill_reminders, goal_updates, weekly_summary, insights, security_alerts, email_notifications, push_notifications) VALUES
(1, 1, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE);

-- ---------- INSIGHTS CACHE ----------
INSERT INTO insights_cache (id, user_id, type, title, description, severity, data, month, year) VALUES
(1, 1, 'overspending', 'Dining over budget', 'Dining spend exceeded the monthly budget', 'warning', '{"category": "Food"}'::jsonb, 9, 2026),
(2, 1, 'savings_drop', 'Savings rate dipped', 'Savings rate fell below 10 percent this month', 'warning', NULL, 9, 2026),
(3, 1, 'burn_rate', 'Burn rate normal', 'Daily spend within projected range', 'info', NULL, 9, 2026),
(4, 1, 'category_alert', 'Transport spike', 'Ride fares up 30 percent vs last month', 'info', NULL, 9, 2026),
(5, 1, 'trend', 'Income steady', 'Income stable for 3 months', 'success', NULL, 9, 2026);

-- ---------- SESSIONS ----------
INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, location, user_agent, is_current, expires_at, last_active_at) VALUES
(1, 1, '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'Chrome on Windows', '127.0.0.1', 'Manila, PH', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', TRUE, '2026-09-15 09:00:00', '2026-09-08 10:00:00'),
(2, 1, '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'Safari on iPhone', '192.168.1.20', 'Manila, PH', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', FALSE, '2026-09-14 18:30:00', '2026-09-07 18:30:00'),
(3, 1, '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b', 'Edge on Windows', '127.0.0.1', 'Quezon City, PH', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120', FALSE, '2026-09-13 12:00:00', '2026-09-06 12:00:00'),
(4, 1, 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35', 'Firefox on Linux', '10.0.0.5', NULL, 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0)', FALSE, '2026-09-12 08:00:00', '2026-09-05 08:00:00'),
(5, 1, '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce', 'Chrome on Android', '192.168.1.30', 'Makati, PH', 'Mozilla/5.0 (Linux; Android 14)', FALSE, '2026-09-11 20:00:00', '2026-09-04 20:00:00');

-- ---------- RESTART SEQUENCES SO FUTURE INSERTS DON'T CLASH ----------
SELECT setval('expenses_id_seq', (SELECT MAX(id) FROM expenses));
SELECT setval('incomes_id_seq', (SELECT MAX(id) FROM incomes));
SELECT setval('budgets_id_seq', (SELECT MAX(id) FROM budgets));
SELECT setval('accounts_id_seq', (SELECT MAX(id) FROM accounts));
SELECT setval('account_transfers_id_seq', (SELECT MAX(id) FROM account_transfers));
SELECT setval('tags_id_seq', (SELECT MAX(id) FROM tags));
SELECT setval('recurring_transactions_id_seq', (SELECT MAX(id) FROM recurring_transactions));
SELECT setval('bills_id_seq', (SELECT MAX(id) FROM bills));
SELECT setval('goals_id_seq', (SELECT MAX(id) FROM goals));
SELECT setval('savings_configs_id_seq', (SELECT MAX(id) FROM savings_configs));
SELECT setval('savings_allocations_id_seq', (SELECT MAX(id) FROM savings_allocations));
SELECT setval('automation_rules_id_seq', (SELECT MAX(id) FROM automation_rules));
SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications));
SELECT setval('user_notification_settings_id_seq', (SELECT MAX(id) FROM user_notification_settings));
SELECT setval('insights_cache_id_seq', (SELECT MAX(id) FROM insights_cache));
SELECT setval('sessions_id_seq', (SELECT MAX(id) FROM sessions));

COMMIT;
