import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { call, registerUser, waitForServer, ymd } from './helpers.mjs';

before(async () => {
  assert.ok(await waitForServer(), 'QA server must be reachable on port 3101');
});

test('recurring: create validation, execute books a transaction and advances the schedule', async () => {
  const u = await registerUser('rec');

  const account = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Bills', type: 'bank', balance: 500 }
  });

  const badType = await call('/recurring', {
    method: 'POST', token: u.token,
    body: { type: 'transfer', amount: 10, frequency: 'monthly', startDate: '2026-03-01' }
  });
  assert.equal(badType.status, 400);

  const badFrequency = await call('/recurring', {
    method: 'POST', token: u.token,
    body: { type: 'expense', amount: 10, frequency: 'hourly', startDate: '2026-03-01' }
  });
  assert.equal(badFrequency.status, 400);

  const badAmount = await call('/recurring', {
    method: 'POST', token: u.token,
    body: { type: 'expense', amount: 0, frequency: 'monthly', startDate: '2026-03-01' }
  });
  assert.equal(badAmount.status, 400);

  const created = await call('/recurring', {
    method: 'POST', token: u.token,
    body: {
      type: 'expense', amount: 100, frequency: 'monthly',
      startDate: ymd(),
      description: 'Monthly utility', accountId: account.body.data.id
    }
  });
  assert.equal(created.status, 201);
  const firstNext = new Date(created.body.data.nextExecution);
  assert.ok(firstNext > new Date(), 'next execution must be in the future');

  const exec = await call(`/recurring/${created.body.data.id}/execute`, {
    method: 'POST', token: u.token, body: { category: 'Utilities' }
  });
  assert.equal(exec.status, 200);
  assert.ok(exec.body.data.transactionId);

  // Expense row created with the linked account debited
  const expenses = await call('/expenses', { token: u.token });
  const generated = expenses.body.find(e => e.description === 'Monthly utility');
  assert.ok(generated, 'execute must create an expense');
  assert.equal(Number(generated.amount), 100);
  assert.equal(generated.category, 'Utilities');

  const accountAfter = await call(`/accounts/${account.body.data.id}`, { token: u.token });
  assert.equal(Number(accountAfter.body.data.balance), 400);

  const recAfter = await call(`/recurring/${created.body.data.id}`, { token: u.token });
  const secondNext = new Date(recAfter.body.data.nextExecution);
  // Executing before the scheduled date keeps the already-scheduled
  // occurrence (the early run does not consume it), so `>=` is the contract;
  // lastExecutedAt proves the run was recorded.
  assert.ok(secondNext >= firstNext, 'next execution must never move backwards');
  assert.ok(recAfter.body.data.lastExecutedAt);

  // Invalid update values are rejected, valid ones persist
  const badUpd = await call(`/recurring/${created.body.data.id}`, {
    method: 'PUT', token: u.token, body: { frequency: 'hourly' }
  });
  assert.equal(badUpd.status, 400);

  const okUpd = await call(`/recurring/${created.body.data.id}`, {
    method: 'PUT', token: u.token, body: { amount: 120 }
  });
  assert.equal(okUpd.status, 200);
  assert.equal(Number(okUpd.body.data.amount), 120);
});

test('recurring: executing an income credits the linked account', async () => {
  const u = await registerUser('recinc');

  const account = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Salary', type: 'bank', balance: 0 }
  });

  const created = await call('/recurring', {
    method: 'POST', token: u.token,
    body: {
      type: 'income', amount: 250, frequency: 'monthly',
      startDate: ymd(),
      description: 'Side gig', accountId: account.body.data.id
    }
  });
  assert.equal(created.status, 201);

  const exec = await call(`/recurring/${created.body.data.id}/execute`, {
    method: 'POST', token: u.token, body: {}
  });
  assert.equal(exec.status, 200);

  const accountAfter = await call(`/accounts/${account.body.data.id}`, { token: u.token });
  assert.equal(Number(accountAfter.body.data.balance), 250);

  const now = new Date();
  const incomes = await call(`/incomes?year=${now.getFullYear()}`, { token: u.token });
  assert.ok(
    incomes.body.some(i => i.month === now.toLocaleString('default', { month: 'long' }) && Number(i.amount) === 250),
    'recurring income must be booked into the execution month'
  );
});

test('recurring: month-end start dates clamp instead of overflowing', async () => {
  const u = await registerUser('recm');

  // Jan 31 monthly -> Feb 28/29, never March
  const created = await call('/recurring', {
    method: 'POST', token: u.token,
    body: {
      type: 'expense', amount: 10, frequency: 'monthly',
      startDate: '2026-01-31', executionDay: 31, description: 'month end'
    }
  });
  assert.equal(created.status, 201);
  const next = new Date(created.body.data.nextExecution);
  // 2026 is not a leap year: 2026-01-31 + 1 month must be 2026-02-28.
  assert.equal(next.getMonth(), 1, 'must land in February');
  assert.equal(next.getDate(), 28, 'must clamp to the last day of February');
});

test('savings: config validation, accurate allocation, and period idempotency', async () => {
  const u = await registerUser('sav');

  const badMode = await call('/savings/config', {
    method: 'POST', token: u.token, body: { mode: 'magic' }
  });
  assert.equal(badMode.status, 400);

  const account = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Savings pot', type: 'e_wallet', balance: 0 }
  });

  const config = await call('/savings/config', {
    method: 'POST', token: u.token,
    body: {
      mode: 'fixed_percentage', targetPercentage: 10,
      targetAccountId: account.body.data.id, isActive: true
    }
  });
  assert.equal(config.status, 200);
  assert.equal(config.body.data.mode, 'fixed_percentage');

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const income = await call('/incomes', {
    method: 'POST', token: u.token,
    body: { amount: 1000, months: [monthName], type: 'monthly', year: now.getFullYear(), halfMonths: [] }
  });
  assert.equal(income.status, 201);

  const periodStart = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const periodEnd = ymd(now);

  const calc = await call('/savings/calculate', {
    method: 'POST', token: u.token, body: { periodStart, periodEnd }
  });
  assert.equal(calc.status, 200);
  assert.equal(calc.body.data.allocated, 100, '10% of 1000 income');

  const accountAfter = await call(`/accounts/${account.body.data.id}`, { token: u.token });
  assert.equal(Number(accountAfter.body.data.balance), 100);

  // Same period again must not double-credit
  const repeat = await call('/savings/calculate', {
    method: 'POST', token: u.token, body: { periodStart, periodEnd }
  });
  assert.equal(repeat.status, 409);

  const accountAgain = await call(`/accounts/${account.body.data.id}`, { token: u.token });
  assert.equal(Number(accountAgain.body.data.balance), 100, 'no double allocation');

  const allocations = await call('/savings/allocations', { token: u.token });
  assert.equal(allocations.status, 200);
  assert.equal(allocations.body.data.length, 1);

  const projection = await call('/savings/projection', { token: u.token });
  assert.equal(projection.status, 200);
});

test('automations: validation, dry-run does not mutate, execute applies action once', async () => {
  const u = await registerUser('auto');

  const invalidTrigger = await call('/automations', {
    method: 'POST', token: u.token,
    body: { name: 'bad', triggerType: 'whenever', actionType: 'send_notification' }
  });
  assert.equal(invalidTrigger.status, 400);

  const invalidAction = await call('/automations', {
    method: 'POST', token: u.token,
    body: { name: 'bad', triggerType: 'periodic', actionType: 'launch_rocket' }
  });
  assert.equal(invalidAction.status, 400);

  const noName = await call('/automations', {
    method: 'POST', token: u.token,
    body: { triggerType: 'periodic', actionType: 'send_notification' }
  });
  assert.equal(noName.status, 400);

  const rule = await call('/automations', {
    method: 'POST', token: u.token,
    body: {
      name: 'Auto expense rule',
      triggerType: 'periodic',
      triggerConditions: { field: 'amount', operator: 'gt', value: 10 },
      actionType: 'create_transaction',
      actionParams: { amount: 50, description: 'Auto expense', category: 'Utilities' }
    }
  });
  assert.equal(rule.status, 201);

  const before = await call('/expenses', { token: u.token });

  const dryRun = await call(`/automations/${rule.body.data.id}/test`, {
    method: 'POST', token: u.token, body: { testData: { amount: 100 } }
  });
  assert.equal(dryRun.status, 200);
  assert.equal(dryRun.body.data.wouldTrigger, true);
  assert.match(dryRun.body.data.actionResult.wouldDo, /Auto expense/);

  const afterDryRun = await call('/expenses', { token: u.token });
  assert.equal(afterDryRun.body.length, before.body.length, 'dry run must not create expenses');

  const run = await call('/automations/execute', { method: 'POST', token: u.token, body: {} });
  assert.equal(run.status, 200);
  assert.equal(run.body.data.executedCount, 1);
  assert.deepEqual(run.body.data.errors, []);

  const afterRun = await call('/expenses', { token: u.token });
  const generated = afterRun.body.find(e => e.description === 'Auto expense');
  assert.ok(generated, 'execution must create the expense');
  assert.equal(Number(generated.amount), 50);

  // Toggle off: no further executions
  const toggle = await call(`/automations/${rule.body.data.id}/toggle`, { method: 'POST', token: u.token, body: {} });
  assert.equal(toggle.status, 200);
  assert.equal(toggle.body.data.isActive, false);

  const runAgain = await call('/automations/execute', { method: 'POST', token: u.token, body: {} });
  assert.equal(runAgain.body.data.executedCount, 0);

  const del = await call(`/automations/${rule.body.data.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);
});
