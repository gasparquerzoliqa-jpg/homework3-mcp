import test from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

test('Health Check', async (t) => {
  const response = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(response.status, 200, 'Health endpoint should return 200');

  const data = await response.json();
  assert.strictEqual(data.status, 'ok', 'Health status should be ok');
  assert(data.timestamp, 'Health response should have timestamp');
});

test('Login - Successful with valid credentials', async (t) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@test.com',
      password: 'password123',
    }),
  });

  assert.strictEqual(response.status, 200, 'Login with valid credentials should return 200');

  const data = await response.json();
  assert.strictEqual(data.success, true, 'Success field should be true');
  assert.strictEqual(data.message, 'Login successful', 'Message should indicate success');
  assert.strictEqual(data.user.email, 'test@test.com', 'User email should match');
  assert.strictEqual(data.user.status, 'active', 'User status should be active');
});

test('Login - Missing email (400 Bad Request)', async (t) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: 'password123',
    }),
  });

  assert.strictEqual(response.status, 400, 'Missing email should return 400');

  const data = await response.json();
  assert(data.error, 'Error response should have error field');
  assert(data.error.includes('required'), 'Error should mention required fields');
});

test('Login - Missing password (400 Bad Request)', async (t) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@test.com',
    }),
  });

  assert.strictEqual(response.status, 400, 'Missing password should return 400');

  const data = await response.json();
  assert(data.error, 'Error response should have error field');
  assert(data.error.includes('required'), 'Error should mention required fields');
});

test('Login - Wrong password (401 Unauthorized)', async (t) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@test.com',
      password: 'wrongpassword',
    }),
  });

  assert.strictEqual(response.status, 401, 'Wrong password should return 401');

  const data = await response.json();
  assert.strictEqual(
    data.error,
    'Invalid email or password',
    'Error message should indicate invalid credentials'
  );
});

test('Login - Non-existent user (401 Unauthorized)', async (t) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'nonexistent@test.com',
      password: 'password123',
    }),
  });

  assert.strictEqual(response.status, 401, 'Non-existent user should return 401');

  const data = await response.json();
  assert.strictEqual(
    data.error,
    'Invalid email or password',
    'Error message should not reveal user existence'
  );
});

test('Login - Blocked user (403 Forbidden)', async (t) => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'blocked@test.com',
      password: 'password123',
    }),
  });

  assert.strictEqual(response.status, 403, 'Blocked user should return 403');

  const data = await response.json();
  assert.strictEqual(data.error, 'User account is blocked', 'Error message should indicate user is blocked');
});
