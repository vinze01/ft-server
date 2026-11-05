import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { call, registerUser, waitForServer } from './helpers.mjs';

before(async () => {
  assert.ok(await waitForServer(), 'QA server must be reachable on port 3101');
});

// Two independent users are created for every isolation test so files never
// share state. Assertions focus on "wrong user cannot see/modify".
async function twoUsers(prefix) {
  const a = await registerUser(`${prefix}_a`);
  const b = await registerUser(`${prefix}_b`);
  return { a, b };
}

test('expenses: users cannot read, update or delete each other rows', async () => {
  const { a, b } = await twoUsers('isoexp');

  const created = await call('/expenses', {
    method: 'POST',
    token: a.token,
    body: { description: 'A private expense', amount: 42.5, category: 'Food', date: '2026-01-15' }
  });
  assert.equal(created.status, 201);
  const expenseId = created.body.id;

  const listB = await call('/expenses', { token: b.token });
  assert.equal(listB.status, 200);
  assert.ok(!listB.body.some(e => e.id === expenseId), 'B must not see A expenses');

  const upd = await call(`/expenses/${expenseId}`, {
    method: 'PUT', token: b.token, body: { amount: 1 }
  });
  assert.equal(upd.status, 404);

  const del = await call(`/expenses/${expenseId}`, { method: 'DELETE', token: b.token });
  assert.equal(del.status, 404);

  // Still intact for A.
  const listA = await call('/expenses', { token: a.token });
  const row = listA.body.find(e => e.id === expenseId);
  assert.equal(Number(row.amount), 42.5);
});

test('incomes: users cannot update or delete each other rows', async () => {
  const { a, b } = await twoUsers('isoinc');

  const created = await call('/incomes', {
    method: 'POST', token: a.token,
    body: { amount: 1000, months: ['January'], type: 'monthly', year: 2025, halfMonths: [] }
  });
  assert.equal(created.status, 201);
  const incomeId = created.body[0].id;

  const upd = await call(`/incomes/${incomeId}`, {
    method: 'PUT', token: b.token, body: { amount: 1 }
  });
  assert.equal(upd.status, 404);

  const del = await call(`/incomes/${incomeId}`, { method: 'DELETE', token: b.token });
  assert.equal(del.status, 404);
});

test('accounts: users cannot read, update, delete or transfer into another users account', async () => {
  const { a, b } = await twoUsers('isoacc');

  const accA = await call('/accounts', {
    method: 'POST', token: a.token,
    body: { name: 'A Wallet', type: 'bank', balance: 500 }
  });
  const accB = await call('/accounts', {
    method: 'POST', token: b.token,
    body: { name: 'B Wallet', type: 'bank', balance: 500 }
  });
  assert.equal(accA.status, 201);
  assert.equal(accB.status, 201);

  const get = await call(`/accounts/${accA.body.data.id}`, { token: b.token });
  assert.equal(get.status, 404);

  const put = await call(`/accounts/${accA.body.data.id}`, {
    method: 'PUT', token: b.token, body: { name: 'hijacked' }
  });
  assert.equal(put.status, 404);

  // Transfer referencing another user's account must fail and move nothing.
  const transfer = await call('/accounts/transfer', {
    method: 'POST', token: b.token,
    body: { fromAccountId: accB.body.data.id, toAccountId: accA.body.data.id, amount: 100 }
  });
  assert.equal(transfer.status, 404);

  const after = await call(`/accounts/${accB.body.data.id}`, { token: b.token });
  assert.equal(Number(after.body.data.balance), 500);
});

test('tags: cannot tag another users transactions, and cannot read links of another users tag', async () => {
  const { a, b } = await twoUsers('isotag');

  const tagA = await call('/tags', { method: 'POST', token: a.token, body: { name: 'A Tag', color: '#123456' } });
  const tagB = await call('/tags', { method: 'POST', token: b.token, body: { name: 'B Tag', color: '#654321' } });
  assert.equal(tagA.status, 201);
  assert.equal(tagB.status, 201);

  const expA = await call('/expenses', {
    method: 'POST', token: a.token,
    body: { description: 'tag target', amount: 10, category: 'Misc', date: '2026-02-01' }
  });

  // B uses their own tag against A's transaction -> 403.
  const cross = await call(`/tags/${tagB.body.data.id}/transactions`, {
    method: 'POST', token: b.token,
    body: { transactionIds: [expA.body.id], transactionType: 'expense' }
  });
  assert.equal(cross.status, 403);

  // B cannot use A's tag id at all.
  const foreignTag = await call(`/tags/${tagA.body.data.id}/transactions`, {
    method: 'POST', token: b.token,
    body: { transactionIds: [expA.body.id], transactionType: 'expense' }
  });
  assert.equal(foreignTag.status, 404);

  // A can tag their own transaction.
  const own = await call(`/tags/${tagA.body.data.id}/transactions`, {
    method: 'POST', token: a.token,
    body: { transactionIds: [expA.body.id], transactionType: 'expense' }
  });
  assert.equal(own.status, 200);

  const links = await call(`/tags/${tagA.body.data.id}/transactions?type=expense`, { token: a.token });
  assert.equal(links.status, 200);
  assert.ok(links.body.data.some(e => e.id === expA.body.id));

  // B reading A's tag links is scoped out (404 tag not found).
  const peek = await call(`/tags/${tagA.body.data.id}/transactions?type=expense`, { token: b.token });
  assert.equal(peek.status, 404);
});

test('goals: users cannot modify each others goals', async () => {
  const { a, b } = await twoUsers('isogoal');

  const goal = await call('/goals', {
    method: 'POST', token: a.token,
    body: { name: 'A Goal', targetAmount: 1000 }
  });
  assert.equal(goal.status, 201);

  const upd = await call(`/goals/${goal.body.data.id}`, {
    method: 'PUT', token: b.token, body: { targetAmount: 5 }
  });
  assert.equal(upd.status, 404);

  const contribute = await call(`/goals/${goal.body.data.id}/contribute`, {
    method: 'POST', token: b.token, body: { amount: 500 }
  });
  assert.equal(contribute.status, 404);

  const del = await call(`/goals/${goal.body.data.id}`, { method: 'DELETE', token: b.token });
  assert.equal(del.status, 404);
});

test('recurring: cannot create or execute against another users account', async () => {
  const { a, b } = await twoUsers('isorec');

  const accA = await call('/accounts', {
    method: 'POST', token: a.token, body: { name: 'Recur A', type: 'bank', balance: 100 }
  });

  // B references A's account -> rejected.
  const create = await call('/recurring', {
    method: 'POST', token: b.token,
    body: {
      type: 'expense', amount: 10, frequency: 'monthly',
      startDate: '2026-03-01', accountId: accA.body.data.id, description: 'evil'
    }
  });
  assert.equal(create.status, 400);

  // A's recurring is invisible to B, hence execute 404.
  const recA = await call('/recurring', {
    method: 'POST', token: a.token,
    body: {
      type: 'expense', amount: 10, frequency: 'monthly',
      startDate: '2026-03-01', description: 'legit'
    }
  });
  assert.equal(recA.status, 201);

  const exec = await call(`/recurring/${recA.body.data.id}/execute`, { method: 'POST', token: b.token, body: {} });
  assert.equal(exec.status, 404);
});

test('automations: cross-user mark_paid does not touch the other users bill', async () => {
  const { a, b } = await twoUsers('isoauto');

  const billA = await call('/bills', {
    method: 'POST', token: a.token,
    body: { name: 'A Bill', amount: 30, dueDay: 15, frequency: 'monthly' }
  });
  assert.equal(billA.status, 201);

  // B creates a periodic rule that (maliciously) targets A's bill.
  const rule = await call('/automations', {
    method: 'POST', token: b.token,
    body: {
      name: 'evil rule', triggerType: 'periodic', triggerConditions: {},
      actionType: 'mark_paid', actionParams: { billId: billA.body.data.id }
    }
  });
  assert.equal(rule.status, 201);

  const run = await call('/automations/execute', { method: 'POST', token: b.token, body: {} });
  assert.equal(run.status, 200);

  const check = await call(`/bills/${billA.body.data.id}`, { token: a.token });
  assert.equal(check.body.data.isPaid, false, 'A bill must remain unpaid');
});

test('savings config rejects another users account reference', async () => {
  const { a, b } = await twoUsers('isosav');

  const accA = await call('/accounts', {
    method: 'POST', token: a.token, body: { name: 'Savings A', type: 'e_wallet', balance: 0 }
  });

  const res = await call('/savings/config', {
    method: 'POST', token: b.token,
    body: { mode: 'fixed_percentage', targetPercentage: 10, targetAccountId: accA.body.data.id }
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /not found/i);
});
