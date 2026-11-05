import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { call, registerUser, waitForServer } from './helpers.mjs';

before(async () => {
  assert.ok(await waitForServer(), 'QA server must be reachable on port 3101');
});

test('accounts: create validation, default flag, update, delete', async () => {
  const u = await registerUser('acc');

  const noName = await call('/accounts', { method: 'POST', token: u.token, body: { balance: 10 } });
  assert.equal(noName.status, 400);

  const badBalance = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Bad', balance: 'lots' }
  });
  assert.equal(badBalance.status, 400);

  const badType = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Bad', type: 'checking' }
  });
  assert.equal(badType.status, 400, 'invalid enum type must be rejected, not 500');

  const first = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Wallet', type: 'cash', balance: 100 }
  });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.isDefault, true, 'first account becomes default');

  const second = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Bank', type: 'bank', balance: 0 }
  });
  assert.equal(second.status, 201);
  assert.equal(second.body.data.isDefault, false);

  const list = await call('/accounts', { token: u.token });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 2);

  const upd = await call(`/accounts/${second.body.data.id}`, {
    method: 'PUT', token: u.token, body: { name: 'Main Bank' }
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.name, 'Main Bank');

  const emptyName = await call(`/accounts/${second.body.data.id}`, {
    method: 'PUT', token: u.token, body: { name: '  ' }
  });
  assert.equal(emptyName.status, 400);

  const summary = await call('/accounts/summary', { token: u.token });
  assert.equal(summary.status, 200);

  const del = await call(`/accounts/${second.body.data.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);

  const after = await call('/accounts', { token: u.token });
  assert.equal(after.body.data.length, 1);
});

test('transfers: exact balances, fee handling, validation and history', async () => {
  const u = await registerUser('trf');

  const from = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'From', type: 'bank', balance: 1000 }
  });
  const to = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'To', type: 'e_wallet', balance: 0 }
  });

  const same = await call('/accounts/transfer', {
    method: 'POST', token: u.token,
    body: { fromAccountId: from.body.data.id, toAccountId: from.body.data.id, amount: 10 }
  });
  assert.equal(same.status, 400);

  const negative = await call('/accounts/transfer', {
    method: 'POST', token: u.token,
    body: { fromAccountId: from.body.data.id, toAccountId: to.body.data.id, amount: -5 }
  });
  assert.equal(negative.status, 400);

  const negativeFee = await call('/accounts/transfer', {
    method: 'POST', token: u.token,
    body: { fromAccountId: from.body.data.id, toAccountId: to.body.data.id, amount: 5, fee: -1 }
  });
  assert.equal(negativeFee.status, 400);

  const insufficient = await call('/accounts/transfer', {
    method: 'POST', token: u.token,
    body: { fromAccountId: from.body.data.id, toAccountId: to.body.data.id, amount: 5000 }
  });
  assert.equal(insufficient.status, 400);

  // 200 + 5 fee: source loses 205, destination gains 200 (fee is not credited).
  const ok = await call('/accounts/transfer', {
    method: 'POST', token: u.token,
    body: { fromAccountId: from.body.data.id, toAccountId: to.body.data.id, amount: 200, fee: 5, note: 'rent fund' }
  });
  assert.equal(ok.status, 201);

  const fromAfter = await call(`/accounts/${from.body.data.id}`, { token: u.token });
  const toAfter = await call(`/accounts/${to.body.data.id}`, { token: u.token });
  assert.equal(Number(fromAfter.body.data.balance), 795);
  assert.equal(Number(toAfter.body.data.balance), 200);

  const history = await call('/accounts/transfers', { token: u.token });
  assert.equal(history.status, 200);
  const entry = history.body.data.find(t => Number(t.amount) === 200);
  assert.ok(entry, 'transfer history must contain the transfer');
  assert.equal(entry.note, 'rent fund');

  const summary = await call('/accounts/summary', { token: u.token });
  assert.equal(summary.status, 200);
});

test('transfers: concurrent requests never overdraw (row locking)', async () => {
  const u = await registerUser('trfc');

  const from = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Source', type: 'bank', balance: 1000 }
  });
  const to = await call('/accounts', {
    method: 'POST', token: u.token, body: { name: 'Sink', type: 'e_wallet', balance: 0 }
  });

  // Drain to 795 first so exactly 3 of the 5 concurrent 200.00 transfers fit.
  const seed = await call('/accounts/transfer', {
    method: 'POST', token: u.token,
    body: { fromAccountId: from.body.data.id, toAccountId: to.body.data.id, amount: 200, fee: 5 }
  });
  assert.equal(seed.status, 201);

  const attempts = await Promise.all(
    Array.from({ length: 5 }, () => call('/accounts/transfer', {
      method: 'POST', token: u.token,
      body: { fromAccountId: from.body.data.id, toAccountId: to.body.data.id, amount: 200 }
    }))
  );

  const successes = attempts.filter(r => r.status === 201).length;
  const failures = attempts.filter(r => r.status === 400).length;
  assert.equal(successes + failures, 5, 'every attempt must resolve deterministically');
  assert.equal(successes, 3, `expected exactly 3 successes, got ${successes}`);

  const fromAfter = await call(`/accounts/${from.body.data.id}`, { token: u.token });
  const toAfter = await call(`/accounts/${to.body.data.id}`, { token: u.token });
  assert.equal(Number(fromAfter.body.data.balance), 195);
  assert.equal(Number(toAfter.body.data.balance), 800);

  const history = await call('/accounts/transfers', { token: u.token });
  assert.equal(history.body.data.length, 4, 'one seed + three successful transfers');
});

test('goals: contributions, completion, un-completion and progress', async () => {
  const u = await registerUser('goal');

  const badTarget = await call('/goals', {
    method: 'POST', token: u.token, body: { name: 'Bad', targetAmount: 0 }
  });
  assert.equal(badTarget.status, 400);

  const created = await call('/goals', {
    method: 'POST', token: u.token,
    body: { name: 'Laptop', targetAmount: 1000, deadline: '2027-01-01', category: 'purchase', priority: 'high' }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.isCompleted, false);

  // Enum validation: an unknown category must be a 400, not a raw DB 500.
  const badCategory = await call('/goals', {
    method: 'POST', token: u.token, body: { name: 'Bad', targetAmount: 10, category: 'tech' }
  });
  assert.equal(badCategory.status, 400);

  const badPriority = await call('/goals', {
    method: 'POST', token: u.token, body: { name: 'Bad', targetAmount: 10, priority: 'urgent' }
  });
  assert.equal(badPriority.status, 400);

  const badCategoryUpd = await call(`/goals/${created.body.data.id}`, {
    method: 'PUT', token: u.token, body: { category: 'tech' }
  });
  assert.equal(badCategoryUpd.status, 400);

  const negContribution = await call(`/goals/${created.body.data.id}/contribute`, {
    method: 'POST', token: u.token, body: { amount: -100 }
  });
  assert.equal(negContribution.status, 400);

  const first = await call(`/goals/${created.body.data.id}/contribute`, {
    method: 'POST', token: u.token, body: { amount: 200 }
  });
  assert.equal(first.status, 200);
  assert.equal(Number(first.body.data.currentAmount), 200);
  assert.equal(first.body.data.isCompleted, false);

  const progress = await call(`/goals/${created.body.data.id}/progress`, { token: u.token });
  assert.equal(progress.status, 200);
  assert.equal(progress.body.data.progress, 20);
  assert.ok(progress.body.data.projectedCompletion);

  const complete = await call(`/goals/${created.body.data.id}/contribute`, {
    method: 'POST', token: u.token, body: { amount: 800 }
  });
  assert.equal(complete.status, 200);
  assert.equal(Number(complete.body.data.currentAmount), 1000);
  assert.equal(complete.body.data.isCompleted, true);
  assert.ok(complete.body.data.completedAt);

  // Raising the target un-completes the goal and clears completedAt (null)
  const raise = await call(`/goals/${created.body.data.id}`, {
    method: 'PUT', token: u.token, body: { targetAmount: 2000 }
  });
  assert.equal(raise.status, 200);
  assert.equal(raise.body.data.isCompleted, false);
  assert.equal(raise.body.data.completedAt, null);

  const summary = await call('/goals/summary', { token: u.token });
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.totalGoals, 1);

  const del = await call(`/goals/${created.body.data.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);
});

test('bills: validation, due-date clamping, mark paid/unpaid, month-scoped summary', async () => {
  const u = await registerUser('bill');

  const badAmount = await call('/bills', {
    method: 'POST', token: u.token, body: { name: 'X', amount: -1, dueDay: 5 }
  });
  assert.equal(badAmount.status, 400);

  const badDay = await call('/bills', {
    method: 'POST', token: u.token, body: { name: 'X', amount: 10, dueDay: 45 }
  });
  assert.equal(badDay.status, 400);

  const badFreq = await call('/bills', {
    method: 'POST', token: u.token, body: { name: 'X', amount: 10, dueDay: 5, frequency: 'weekly' }
  });
  assert.equal(badFreq.status, 400);

  // dueDay 31 must clamp to a real day in the target month, never overflow.
  const clamped = await call('/bills', {
    method: 'POST', token: u.token, body: { name: 'Rent', amount: 800, dueDay: 31, frequency: 'monthly' }
  });
  assert.equal(clamped.status, 201);
  const clampedDate = new Date(clamped.body.data.nextDueDate);
  assert.ok(!isNaN(clampedDate.getTime()));
  const nextMonthFirst = new Date(clampedDate.getFullYear(), clampedDate.getMonth() + 1, 1);
  assert.ok(clampedDate < nextMonthFirst, 'nextDueDate must stay inside its own month');

  // Bill due today, for summary scoping
  const today = new Date();
  const bill = await call('/bills', {
    method: 'POST', token: u.token,
    body: {
      name: 'Internet', amount: 60, dueDay: today.getDate(),
      frequency: 'monthly', isSubscription: true
    }
  });
  assert.equal(bill.status, 201);

  const summaryNow = await call(`/bills/summary?month=${today.getMonth() + 1}&year=${today.getFullYear()}`, { token: u.token });
  assert.equal(summaryNow.status, 200);
  assert.ok(summaryNow.body.data.totalDue >= 60);
  assert.ok(summaryNow.body.data.subscriptions >= 1);

  const future = new Date(today.getFullYear(), today.getMonth() + 6, 15);
  const summaryFuture = await call(`/bills/summary?month=${future.getMonth() + 1}&year=${future.getFullYear()}`, { token: u.token });
  assert.equal(summaryFuture.body.data.totalDue, 0, 'far-future month has no bills');

  // Mark paid: paidDate set, next occurrence advanced
  const paid = await call(`/bills/${bill.body.data.id}/mark-paid`, { method: 'POST', token: u.token, body: {} });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.data.isPaid, true);
  assert.ok(paid.body.data.paidDate);
  const advanced = new Date(paid.body.data.nextDueDate);
  assert.ok(advanced >= today, 'next due date must not be in the past');

  // Mark unpaid: paidDate must be cleared to null
  const unpaid = await call(`/bills/${bill.body.data.id}/mark-unpaid`, { method: 'POST', token: u.token, body: {} });
  assert.equal(unpaid.status, 200);
  assert.equal(unpaid.body.data.isPaid, false);
  assert.equal(unpaid.body.data.paidDate, null);

  // Partial update keeps other fields, allows reminderDays 0
  const upd = await call(`/bills/${bill.body.data.id}`, {
    method: 'PUT', token: u.token, body: { reminderDays: 0 }
  });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.data.reminderDays, 0);
  assert.equal(upd.body.data.name, 'Internet');

  const dueSoon = await call('/bills/due-soon?days=400', { token: u.token });
  assert.equal(dueSoon.status, 200);

  const del = await call(`/bills/${bill.body.data.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);
});
