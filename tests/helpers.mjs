// Shared helpers for the QA integration suite.
// Runs against a disposable QA server (default http://localhost:3101/api).
// No external test dependencies — plain fetch + node:test.

export const API = process.env.QA_API_URL || 'http://localhost:3101/api';

/**
 * Small fetch wrapper returning { status, body, text, headers }.
 * `body` may be a plain object (JSON) or a FormData instance (multipart).
 */
export async function call(path, { method = 'GET', body, token, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;

  let payload;
  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const res = await fetch(`${API}${path}`, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // CSV / plain-text responses
  }
  return { status: res.status, body: json, text, headers: res.headers };
}

let counter = 0;

/** Collision-free identifier for usernames/emails within a run. */
export function uid(prefix = 'qa') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Register a fresh user and return { username, password, email, token, user }.
 * Every test file gets its own users, so files stay independent.
 */
export async function registerUser(prefix = 'user') {
  const username = uid(prefix);
  const password = 'UITest123!';
  const email = `${username}@example.test`;

  const res = await call('/register', {
    method: 'POST',
    body: {
      username,
      password,
      firstName: 'QA',
      middleName: '',
      lastName: 'Tester',
      contactNo: '09171234567',
      email
    }
  });

  if (![200, 201].includes(res.status)) {
    throw new Error(`register failed: ${res.status} ${res.text}`);
  }

  // The register endpoint only acknowledges creation (the UI redirects to
  // /login afterwards), so obtain a token through the normal login flow.
  return loginUser(username, password);
}

/** Logs in and returns { username, password, token, user }. */
export async function loginUser(username, password) {
  const res = await call('/login', {
    method: 'POST',
    body: { username, password }
  });

  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`login failed: ${res.status} ${res.text}`);
  }

  return { username, password, token: res.body.token, user: res.body.user, email: res.body.user?.email };
}

/** Waits for the QA server (and its DB) to accept requests. */
export async function waitForServer(retries = 60) {
  const healthUrl = API.replace(/\/api\/?$/, '') + '/health';
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) return true;
    } catch {
      // server not up yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

/** Builds a multipart body for the CSV import endpoint. */
export function csvFile(content, filename = 'import.csv') {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/csv' }), filename);
  return form;
}

/**
 * Local `YYYY-MM-DD` string.
 * `Date#toISOString()` converts to UTC, which yields the *previous* day in
 * positive-offset timezones — never use it for date-only API fields.
 */
export function ymd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
