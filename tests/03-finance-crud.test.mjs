import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { call, registerUser, waitForServer } from './helpers.mjs';

before(async () => {
  assert.ok(await waitForServer(), 'QA server must be reachable on port 3101');
});

test('expenses: create / validate / sort / filter / search / update / delete', async () => {
  const u = await registerUser('exp');

  // Validation
  const badAmount = await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'x', amount: -5, category: 'Food', date: '2026-01-10' }
  });
  assert.equal(badAmount.status, 400);

  const badDate = await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'x', amount: 5, category: 'Food', date: 'not-a-date' }
  });
  assert.equal(badDate.status, 400);

  const missingDesc = await call('/expenses', {
    method: 'POST', token: u.token,
    body: { amount: 5, category: 'Food', date: '2026-01-10' }
  });
  assert.equal(missingDesc.status, 400);

  // Create: one in Jan, one in Feb, one with tricky search text
  const jan = await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'Groceries', amount: 50, category: 'Food', date: '2026-01-10', note: 'weekly' }
  });
  assert.equal(jan.status, 201);
  assert.equal(Number(jan.body.amount), 50);

  const feb = await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'Bus pass', amount: 30, category: 'Transport', date: '2026-02-03' }
  });
  assert.equal(feb.status, 201);

  const special = await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'Café "100%" + snacks', amount: 12.25, category: 'Food', date: '2026-01-20' }
  });
  assert.equal(special.status, 201);

  // Default ordering: date DESC, id DESC (stable)
  const all = await call('/expenses', { token: u.token });
  assert.equal(all.status, 200);
  const dates = all.body.map(e => new Date(e.date).getTime());
  const sorted = [...dates].sort((a, b) => b - a);
  assert.deepEqual(dates, sorted, 'expenses must be date DESC');

  // Month filter
  const janOnly = await call('/expenses?month=2026-01', { token: u.token });
  assert.equal(janOnly.status, 200);
  assert.equal(janOnly.body.length, 2);
  assert.ok(janOnly.body.every(e => new Date(e.date).getMonth() === 0));

  // Invalid month
  const badMonth = await call('/expenses?month=2026-13', { token: u.token });
  assert.equal(badMonth.status, 400);

  // Category filter
  const food = await call('/expenses?category=Food', { token: u.token });
  assert.equal(food.body.length, 2);

  // Search: case-insensitive, trims whitespace, matches note too
  const search = await call('/expenses?search=%20groceries%20', { token: u.token });
  assert.equal(search.status, 200);
  assert.equal(search.body.length, 1);
  assert.equal(search.body[0].description, 'Groceries');

  const searchNote = await call('/expenses?search=weekly', { token: u.token });
  assert.equal(searchNote.body.length, 1);

  // Special characters must not crash
  const specialSearch = await call('/expenses?search=' + encodeURIComponent('100%'), { token: u.token });
  assert.equal(specialSearch.status, 200);

  // Combined filters
  const combo = await call('/expenses?month=2026-01&category=Transport', { token: u.token });
  assert.equal(combo.body.length, 0);

  // Update (partial) keeps optional fields
  const upd = await call(`/expenses/${feb.body.id}`, {
    method: 'PUT', token: u.token, body: { amount: 35.5 }
  });
  assert.equal(upd.status, 200);
  assert.equal(Number(upd.body.amount), 35.5);
  assert.equal(upd.body.description, 'Bus pass');

  const badUpd = await call(`/expenses/${feb.body.id}`, {
    method: 'PUT', token: u.token, body: { amount: 0 }
  });
  assert.equal(badUpd.status, 400);

  // Delete removes it from the list, persists after refetch
  const del = await call(`/expenses/${feb.body.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);
  const after = await call('/expenses', { token: u.token });
  assert.ok(!after.body.some(e => e.id === feb.body.id));

  // Monthly summary reflects remaining rows
  const summary = await call('/expenses/summary?month=2026-01', { token: u.token });
  assert.equal(summary.status, 200);
  assert.equal(Number(summary.body.totalExpenses.Food), 62.25);
});

test('incomes: bulk create, duplicate guard, chronological sort, validation', async () => {
  const u = await registerUser('inc');

  const badType = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 100, months: ['January'], type: 'weekly', year: 2025, halfMonths: [] }
  });
  assert.equal(badType.status, 400);

  const badAmount = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 0, months: ['January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(badAmount.status, 400);

  const noMonths = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 100, months: [], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(noMonths.status, 400);

  // Bulk create: March + January of 2025 -> 2 rows
  const bulk = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 1000, months: ['March', 'January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(bulk.status, 201);
  assert.equal(bulk.body.length, 2);

  // Duplicate period is rejected (whole request, no partial writes)
  const dup = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 1000, months: ['January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(dup.status, 400);

  // Bi-monthly: two halves in one month are distinct rows
  const bi = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 500, months: ['April'], type: 'bi-monthly', year: 2025, halfMonths: [1, 2] }
  });
  assert.equal(bi.status, 201);
  assert.equal(bi.body.length, 2);

  const biDup = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 500, months: ['April'], type: 'bi-monthly', year: 2025, halfMonths: [1] }
  });
  assert.equal(biDup.status, 400);

  // Chronological ordering (not alphabetical): March before January
  const list = await call('/incomes?year=2025', { token: u.token });
  assert.equal(list.status, 200);
  const months = list.body.map(i => i.month);
  assert.ok(
    months.indexOf('March') < months.indexOf('January'),
    `expected March before January, got ${months.join(',')}`
  );
  assert.equal(months[0], 'April', 'April (bi-monthly, half 2) should lead');

  // Update to a conflicting period is rejected; a valid partial update works
  const januaryRow = list.body.find(i => i.month === 'January');
  const conflict = await call(`/incomes/${januaryRow.id}`, {
    method: 'PUT', token: u.token,
    body: { type: 'monthly', month: 'March', year: 2025 }
  });
  assert.equal(conflict.status, 400);

  const okUpd = await call(`/incomes/${januaryRow.id}`, {
    method: 'PUT', token: u.token, body: { amount: 1500 }
  });
  assert.equal(okUpd.status, 200);
  assert.equal(Number(okUpd.body.amount), 1500);

  // Delete
  const del = await call(`/incomes/${januaryRow.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);
  const after = await call('/incomes?year=2025', { token: u.token });
  assert.ok(!after.body.some(i => i.id === januaryRow.id));
});

test('budgets: duplicate guard per period, bi-monthly distinct halves, chronological sort', async () => {
  const u = await registerUser('bud');

  const badAmount = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Food', amount: -1, months: ['January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(badAmount.status, 400);

  const missingCategory = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { amount: 100, months: ['January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(missingCategory.status, 400);

  const created = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Food', amount: 300, months: ['March', 'January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.length, 2);

  const dup = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Food', amount: 300, months: ['January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(dup.status, 400);

  // Same category/year but a different month → allowed
  const otherMonth = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Food', amount: 300, months: ['February'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(otherMonth.status, 201);

  // Bi-monthly: both halves in one month, then a different month with half 1
  // (regression: the duplicate check used to ignore `month`)
  const bi = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Fun', amount: 100, months: ['May'], type: 'bi-monthly', year: 2025, halfMonths: [1, 2] }
  });
  assert.equal(bi.status, 201);
  assert.equal(bi.body.length, 2);

  const biOtherMonth = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Fun', amount: 100, months: ['June'], type: 'bi-monthly', year: 2025, halfMonths: [1] }
  });
  assert.equal(biOtherMonth.status, 201, 'same category in another month must not be a duplicate');

  const biDup = await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Fun', amount: 100, months: ['May'], type: 'bi-monthly', year: 2025, halfMonths: [1] }
  });
  assert.equal(biDup.status, 400);

  // Sorting: year DESC then month DESC chronologically
  const list = await call('/budgets?year=2025', { token: u.token });
  assert.equal(list.status, 200);
  const monthSeq = list.body.map(b => b.month);
  assert.ok(monthSeq.indexOf('March') < monthSeq.indexOf('February'));
  assert.ok(monthSeq.indexOf('February') < monthSeq.indexOf('January'));

  // Update amount
  const jan = list.body.find(b => b.category === 'Food' && b.month === 'January');
  const upd = await call(`/budgets/${jan.id}`, {
    method: 'PUT', token: u.token, body: { amount: 450 }
  });
  assert.equal(upd.status, 200);
  assert.equal(Number(upd.body.amount), 450);

  const del = await call(`/budgets/${jan.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);
});

test('dashboard reflects income, expenses and budget status for the selected month', async () => {
  const u = await registerUser('dash');

  await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 1000, months: ['January'], type: 'monthly', year: 2026, halfMonths: [] }
  });
  await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'Rent', amount: 250, category: 'Housing', date: '2026-01-05' }
  });
  await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'Lunch', amount: 50, category: 'Food', date: '2026-01-20' }
  });
  await call('/budgets', {
    method: 'POST', token: u.token,
    body: { category: 'Food', amount: 200, months: ['January'], type: 'monthly', year: 2026, halfMonths: [] }
  });
  // An expense outside the selected month must not leak in
  await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'Feb thing', amount: 999, category: 'Food', date: '2026-02-02' }
  });

  const dash = await call('/dashboard?view=monthly&year=2026&month=1', { token: u.token });
  assert.equal(dash.status, 200);
  assert.equal(dash.body.totalIncome, 1000);
  assert.equal(dash.body.totalExpenses, 300);
  assert.equal(dash.body.balance, 700);
  assert.equal(dash.body.expensesByCategory.Housing, 250);
  assert.equal(dash.body.expensesByCategory.Food, 50);

  const foodBudget = dash.body.budgetStatus.find(b => b.category === 'Food');
  assert.equal(foodBudget.budgeted, 200);
  assert.equal(foodBudget.spent, 50);
  assert.equal(foodBudget.remaining, 150);

  // After deleting an expense the dashboard recalculates
  const expenses = await call('/expenses?month=2026-01', { token: u.token });
  const lunch = expenses.body.find(e => e.description === 'Lunch');
  await call(`/expenses/${lunch.id}`, { method: 'DELETE', token: u.token });

  const dash2 = await call('/dashboard?view=monthly&year=2026&month=1', { token: u.token });
  assert.equal(dash2.body.totalExpenses, 250);
  assert.equal(dash2.body.expensesByCategory.Food, undefined);
});

test('analytics endpoints return accurate aggregates', async () => {
  const u = await registerUser('anl');

  await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'A', amount: 100, category: 'Food', date: '2026-01-10' }
  });
  await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'B', amount: 50, category: 'Food', date: '2026-01-11' }
  });
  await call('/expenses', {
    method: 'POST', token: u.token,
    body: { description: 'C', amount: 25, category: 'Transport', date: '2026-01-12' }
  });

  const byCat = await call('/analytics/expenses-by-category?from=2026-01-01&to=2026-01-31', { token: u.token });
  assert.equal(byCat.status, 200);
  const food = byCat.body.data.find(r => r.category === 'Food');
  assert.equal(food.amount, 150);
  assert.equal(food.percentage, 85.7);

  const incomeByCat = await call('/analytics/income-by-category?from=2026-01-01&to=2026-01-31', { token: u.token });
  assert.equal(incomeByCat.status, 200);
  assert.ok(Array.isArray(incomeByCat.body.data));

  const savings = await call('/analytics/savings-rate?months=3', { token: u.token });
  assert.equal(savings.status, 200);
  assert.equal(savings.body.data.length, 3);
  assert.ok(typeof savings.body.overallRate === 'number');

  const netWorth = await call('/analytics/net-worth', { token: u.token });
  assert.equal(netWorth.status, 200);

  const burn = await call('/analytics/burn-rate', { token: u.token });
  assert.equal(burn.status, 200);
});
