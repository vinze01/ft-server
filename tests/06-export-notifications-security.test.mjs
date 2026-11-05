import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import speakeasy from 'speakeasy';
import pg from 'pg';
import { call, registerUser, waitForServer, uid, csvFile } from './helpers.mjs';

before(async () => {
  assert.ok(await waitForServer(), 'QA server must be reachable on port 3101');
});

test('CSV export quotes values correctly and the template is public', async () => {
  const u = await registerUser('csv');

  await call('/expenses', {
    method: 'POST', token: u.token,
    body: {
      description: 'Groceries, "fresh"',
      amount: 12.34,
      category: 'Food',
      date: '2026-01-15',
      note: 'contains, comma'
    }
  });

  const csv = await call('/export/transactions?type=expense&format=csv', { token: u.token });
  assert.equal(csv.status, 200);
  assert.match(csv.text.split('\n')[0], /Description/);
  assert.match(csv.text, /"Groceries, ""fresh"""/);
  assert.match(csv.text, /"contains, comma"/);

  const template = await call('/import/template');
  assert.equal(template.status, 200);
  assert.equal(template.text.split('\n')[0].trim(), 'type,amount,category,date,note');
});

test('CSV import round-trips rows and reports per-row errors', async () => {
  const u = await registerUser('imp');

  const good = [
    'type,amount,category,date,note',
    'income,1000,Salary,2026-01-15,Monthly salary',
    'expense,50,Groceries,2026-01-20,"Weekly ""big"" shop, with comma"'
  ].join('\n');

  const ok = await call('/import/transactions', {
    method: 'POST', token: u.token, body: csvFile(good)
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.imported, 2);
  assert.deepEqual(ok.body.data.errors, []);

  const incomes = await call('/incomes?year=2026', { token: u.token });
  const salary = incomes.body.find(i => i.category === 'Salary');
  assert.ok(salary, 'imported income must be booked into its row period');
  assert.equal(salary.month, 'January');

  const expenses = await call('/expenses?category=Groceries', { token: u.token });
  assert.equal(expenses.body.length, 1);
  assert.equal(expenses.body[0].note, 'Weekly "big" shop, with comma');
  assert.ok(expenses.body[0].description, 'template rows have no description column; it must fall back, not be blank');

  // The fallback description stays searchable.
  const searchable = await call('/expenses?search=Weekly', { token: u.token });
  assert.equal(searchable.body.length, 1);

  const mixed = [
    'type,amount,category,date,note',
    'expense,-5,Bad,2026-02-01,negative amount',
    'expense,10,Bad,not-a-date,bad date',
    'expense,25,Good,2026-02-02,valid'
  ].join('\n');

  const partial = await call('/import/transactions', {
    method: 'POST', token: u.token, body: csvFile(mixed)
  });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.data.imported, 1);
  assert.equal(partial.body.data.errors.length, 2);
  assert.match(partial.body.data.errors[0], /Row 2/);
});

test('notifications: unread count, mark read, read-all, delete', async () => {
  const u = await registerUser('notif');

  const initial = await call('/notifications/unread-count', { token: u.token });
  assert.equal(initial.status, 200);

  // Generate a notification through the automation engine.
  const rule = await call('/automations', {
    method: 'POST', token: u.token,
    body: {
      name: 'Notify', triggerType: 'periodic', triggerConditions: {},
      actionType: 'send_notification',
      actionParams: { title: 'QA Alert', message: 'Integration test notification' }
    }
  });
  assert.equal(rule.status, 201);

  const run = await call('/automations/execute', { method: 'POST', token: u.token, body: {} });
  assert.equal(run.body.data.executedCount, 1);

  const count = await call('/notifications/unread-count', { token: u.token });
  assert.equal(count.status, 200);
  const unread = count.body.data?.count ?? count.body.count;
  assert.equal(unread, 1);

  const list = await call('/notifications', { token: u.token });
  assert.equal(list.status, 200);
  const notification = (list.body.data || list.body)[0];
  assert.equal(notification.title, 'QA Alert');

  const read = await call(`/notifications/${notification.id}/read`, { method: 'POST', token: u.token, body: {} });
  assert.equal(read.status, 200);

  const count2 = await call('/notifications/unread-count', { token: u.token });
  assert.equal(count2.body.data?.count ?? count2.body.count, 0);

  // Generate another and clear it with read-all
  await call('/automations/execute', { method: 'POST', token: u.token, body: {} });
  const readAll = await call('/notifications/read-all', { method: 'POST', token: u.token, body: {} });
  assert.equal(readAll.status, 200);
  const count3 = await call('/notifications/unread-count', { token: u.token });
  assert.equal(count3.body.data?.count ?? count3.body.count, 0);

  const del = await call(`/notifications/${notification.id}`, { method: 'DELETE', token: u.token });
  assert.equal(del.status, 200);
});

test('2FA: enable -> verify -> login challenge enforced -> disable requires password', async () => {
  const u = await registerUser('2fa');

  const enable = await call('/security/2fa/enable', { method: 'POST', token: u.token, body: {} });
  assert.equal(enable.status, 200);
  const secret = enable.body.data.secret;
  assert.ok(secret);
  assert.ok(enable.body.data.qrCode.startsWith('data:image'));

  // Before verification the challenge must NOT be active
  const preLogin = await call('/login', {
    method: 'POST', body: { username: u.username, password: u.password }
  });
  assert.equal(preLogin.status, 200);

  const verify = await call('/security/2fa/verify', {
    method: 'POST', token: u.token,
    body: { code: speakeasy.totp({ secret, encoding: 'base32' }) }
  });
  assert.equal(verify.status, 200);

  // Now login without a code is rejected with requires2FA
  const noCode = await call('/login', {
    method: 'POST', body: { username: u.username, password: u.password }
  });
  assert.equal(noCode.status, 401);
  assert.equal(noCode.body.requires2FA, true);

  const wrongCode = await call('/login', {
    method: 'POST', body: { username: u.username, password: u.password, totpCode: '000000' }
  });
  assert.equal(wrongCode.status, 401);

  const goodCode = await call('/login', {
    method: 'POST', body: {
      username: u.username, password: u.password,
      totpCode: speakeasy.totp({ secret, encoding: 'base32' })
    }
  });
  assert.equal(goodCode.status, 200);
  assert.ok(goodCode.body.token);

  // Disable requires the correct password
  const wrongPw = await call('/security/2fa/disable', {
    method: 'POST', token: goodCode.body.token, body: { password: 'nope' }
  });
  assert.equal(wrongPw.status, 400);

  const disabled = await call('/security/2fa/disable', {
    method: 'POST', token: goodCode.body.token, body: { password: u.password }
  });
  assert.equal(disabled.status, 200);

  const loginAfter = await call('/login', {
    method: 'POST', body: { username: u.username, password: u.password }
  });
  assert.equal(loginAfter.status, 200, 'login without TOTP works after disabling 2FA');
});

test('password reset tokens are single-use and expire', async () => {
  const u = await registerUser('rst');

  let client;
  try {
    client = new pg.Client({
      host: process.env.QA_DB_HOST || 'localhost',
      port: parseInt(process.env.QA_DB_PORT || '5432', 10),
      user: process.env.QA_DB_USER || 'postgres',
      password: process.env.QA_DB_PASSWORD || 'rvtdbdev',
      database: process.env.QA_DB_NAME || 'finance_tracker_qa'
    });
    await client.connect();
  } catch (err) {
    if (client) await client.end().catch(() => {});
    throw new Error(
      'QA database must be reachable for reset-token tests (QA_DB_* env vars): ' + err.message
    );
  }

  try {
    const token = 'qa_reset_' + uid('tok');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const future = new Date(Date.now() + 60 * 60 * 1000);

    await client.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE username = $3',
      [tokenHash, future, u.username]
    );

    const shortPw = await call('/reset-password', {
      method: 'POST', body: { token, newPassword: '123' }
    });
    assert.equal(shortPw.status, 400);

    const reset = await call('/reset-password', {
      method: 'POST', body: { token, newPassword: 'NewPass123!' }
    });
    assert.equal(reset.status, 200);

    // New password works
    const login = await call('/login', {
      method: 'POST', body: { username: u.username, password: 'NewPass123!' }
    });
    assert.equal(login.status, 200);

    // Replay with the same token is rejected
    const replay = await call('/reset-password', {
      method: 'POST', body: { token, newPassword: 'Another123!' }
    });
    assert.equal(replay.status, 400);
    assert.match(replay.body.error, /invalid|expired/i);

    // And the stored token is actually null (Sequelize undefined-stripping bug regression)
    const row = await client.query('SELECT reset_token, reset_token_expiry FROM users WHERE username = $1', [u.username]);
    assert.equal(row.rows[0].reset_token, null);
    assert.equal(row.rows[0].reset_token_expiry, null);

    // Expired token is rejected
    const expiredToken = 'qa_expired_' + uid('tok');
    const expiredHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    await client.query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE username = $3',
      [expiredHash, new Date(Date.now() - 1000), u.username]
    );
    const expired = await call('/reset-password', {
      method: 'POST', body: { token: expiredToken, newPassword: 'Whatever123!' }
    });
    assert.equal(expired.status, 400);
  } finally {
    await client.end();
  }
});

test('change password via /security/password stores a hash and rejects the wrong current password', async () => {
  const u = await registerUser('chpw');

  const wrong = await call('/security/password', {
    method: 'PUT', token: u.token,
    body: { currentPassword: 'wrong', newPassword: 'BrandNew123!' }
  });
  assert.equal(wrong.status, 400);

  const ok = await call('/security/password', {
    method: 'PUT', token: u.token,
    body: { currentPassword: u.password, newPassword: 'BrandNew123!' }
  });
  assert.equal(ok.status, 200);

  const loginOld = await call('/login', {
    method: 'POST', body: { username: u.username, password: u.password }
  });
  assert.equal(loginOld.status, 401);

  const loginNew = await call('/login', {
    method: 'POST', body: { username: u.username, password: 'BrandNew123!' }
  });
  assert.equal(loginNew.status, 200);
});
