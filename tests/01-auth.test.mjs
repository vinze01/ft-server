import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { call, registerUser, uid, waitForServer } from './helpers.mjs';

before(async () => {
  assert.ok(await waitForServer(), 'QA server must be reachable on port 3101');
});

test('register rejects missing required fields', async () => {
  const res = await call('/register', {
    method: 'POST',
    body: { username: uid('x'), password: 'UITest123!', firstName: 'A', lastName: 'B' }
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /required/i);
});

test('register rejects malformed email', async () => {
  const res = await call('/register', {
    method: 'POST',
    body: {
      username: uid('x'), password: 'UITest123!',
      firstName: 'A', lastName: 'B', contactNo: '09171234567',
      email: 'not-an-email'
    }
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /email/i);
});

test('register rejects short password', async () => {
  const res = await call('/register', {
    method: 'POST',
    body: {
      username: uid('x'), password: '123',
      firstName: 'A', lastName: 'B', contactNo: '09171234567',
      email: `${uid('x')}@example.test`
    }
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /password/i);
});

test('register rejects non-digit contact number', async () => {
  const res = await call('/register', {
    method: 'POST',
    body: {
      username: uid('x'), password: 'UITest123!',
      firstName: 'A', lastName: 'B', contactNo: 'abc123',
      email: `${uid('x')}@example.test`
    }
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /contact/i);
});

test('register rejects duplicate email with a distinct username', async () => {
  const user = await registerUser('dup');
  const res = await call('/register', {
    method: 'POST',
    body: {
      username: uid('dup2'), password: 'UITest123!',
      firstName: 'A', lastName: 'B', contactNo: '09171234567',
      email: user.email
    }
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /already exists/i);
});

test('login rejects wrong password', async () => {
  const user = await registerUser('login');
  const res = await call('/login', {
    method: 'POST',
    body: { username: user.username, password: 'wrong-password' }
  });
  assert.equal(res.status, 401);
  assert.match(res.body.error, /invalid credentials/i);
});

test('login succeeds and never leaks the password hash', async () => {
  const user = await registerUser('login2');
  const res = await call('/login', {
    method: 'POST',
    body: { username: user.username, password: user.password }
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.username, user.username);
});

test('protected endpoints reject missing tokens', async () => {
  for (const path of ['/me', '/expenses', '/incomes', '/accounts', '/dashboard']) {
    const res = await call(path);
    assert.equal(res.status, 401, `${path} should require auth`);
  }
});

test('protected endpoints reject malformed / wrong-secret tokens', async () => {
  const user = await registerUser('tok');
  const forged = jwt.sign({ userId: user.user.id }, 'definitely-not-the-secret', { expiresIn: '1h' });

  const res = await call('/me', { token: forged });
  assert.equal(res.status, 403);

  const expired = jwt.sign({ userId: user.user.id }, 'definitely-not-the-secret', { expiresIn: -10 });
  const res2 = await call('/me', { token: expired });
  assert.equal(res2.status, 403);
});

test('GET /me returns the authenticated user without the password hash', async () => {
  const user = await registerUser('me');
  const res = await call('/me', { token: user.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.id, user.user.id);
  assert.equal(res.body.password, undefined);
});

test('malformed :id params are rejected before hitting controllers', async () => {
  const user = await registerUser('id');
  const res = await call('/expenses/not-an-id', { method: 'DELETE', token: user.token });
  assert.equal(res.status, 400);
});

test('unknown api routes return 404 JSON, not a crash', async () => {
  const user = await registerUser('nf');
  const res = await call('/does-not-exist', { token: user.token });
  assert.equal(res.status, 404);
});
