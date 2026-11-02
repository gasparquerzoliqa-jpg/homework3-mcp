# Homework 3: MCP Tools & Incident Investigation

## Overview

This homework demonstrates the use of Model Context Protocol (MCP) tools to investigate and resolve a failing smoke test in the auth-service application. The investigation used three MCP tools to diagnose the root cause: a blocked user account status in the database.

## Tests & MCP Setup

### Smoke Tests

The smoke tests (`tests/smoke.test.mjs`) validate core auth-service functionality using Node's built-in test runner:

```bash
npm run test:smoke
```

**Test Coverage:**
- Health Check: Validates `/health` endpoint returns 200 with status 'ok'
- Login - Successful with valid credentials: Tests login with email='test@test.com', password='password123' (expects 200)
- Login - Missing email: Validates 400 Bad Request when email is omitted
- Login - Missing password: Validates 400 Bad Request when password is omitted
- Login - Wrong password: Validates 401 Unauthorized for incorrect password
- Login - Non-existent user: Validates 401 Unauthorized for non-existent user
- Login - Blocked user: Validates 403 Forbidden for blocked user (email='blocked@test.com')

### MCP Server

The MCP server (`mcp-server/server.js`) exposes three tools to Claude Code via the Model Context Protocol:

1. **`get_docker_logs`** - Read logs from Docker containers with optional text filtering
   - Parameters: `container` (default: 'auth-service'), `tail` (default: 100), `filter` (optional)
   - Returns: Docker container logs

2. **`query_database`** - Execute read-only SELECT queries against the SQLite database
   - Parameters: `sql` (SELECT query only)
   - Returns: JSON query results

3. **`get_app_log`** - Read JSON logs from `/app/logs/app.log` with optional filtering
   - Parameters: `tail` (default: 100), `filter` (optional)
   - Returns: Application structured logs

**MCP Configuration:** `.mcp.json` defines the server connection for Claude Code.

## Running the Tools

### Start the MCP Server

The MCP server is started via Claude Code settings in `.claude/settings.local.json`. It spawns `mcp-server/server.js` as a stdio transport.

### Using the Tools in Claude Code

1. `/mcp` - Lists available MCP tools
2. Call tools directly in prompts to query database, read logs, or inspect container state

### Example: Query User Status

```
query_database: SELECT email, status FROM users WHERE email = 'test@test.com'
```

## Incident Investigation

### Failed Test

**Test:** "Login - Successful with valid credentials"  
**Expected:** HTTP 200  
**Actual:** HTTP 403  
**Credentials:** email='test@test.com', password='password123'

### Investigation Process

The investigation used three MCP tools to diagnose the failure:

#### 1. Database Query - User Status

**MCP Tool Called:**
```
query_database: SELECT email, status FROM users WHERE email = 'test@test.com'
```

**Evidence:**
```json
[{"email":"test@test.com","status":"blocked"}]
```

The test user account was marked with status 'blocked' instead of 'active'.

#### 2. Application Log - Login Attempt Reason

**MCP Tool Called:**
```
get_app_log: filter='test@test.com', tail=50
```

**Evidence:**
```json
{"level":40,"time":1793580743206,"pid":1,"hostname":"1f2c29bf55a8","event":"login_attempt","email":"test@test.com","reason":"user_blocked","status":"blocked"}
```

The application correctly identified the user as blocked and rejected the login with a 403 response.

#### 3. Docker Logs - Container State

**MCP Tool Called:**
```
get_docker_logs: container='auth-service', filter='test@test.com', tail=50
```

**Evidence:**
```
(no matching log lines)
```

No errors in the docker logs; the application was operating normally.

### Root Cause

**The test user account (`test@test.com`) had status `'blocked'` in the database.**

The auth-service application correctly implemented access control by:
1. Checking the user's status in the database
2. Rejecting login attempts from blocked users with HTTP 403
3. Logging the rejection reason as `"user_blocked"` in the application log

The failure was due to incorrect test data setup, not a code defect.

### Resolution

The user account was restored to active status:
```bash
docker-compose exec auth-service node dist/restore_user.js test@test.com
```

**Verification:**
```
query_database: SELECT email, status FROM users WHERE email = 'test@test.com'
```

**Result:**
```json
[{"email":"test@test.com","status":"active"}]
```

### Test Results After Fix

```
✔ Health Check (159.5932ms)
✔ Login - Successful with valid credentials (27.7726ms)
✔ Login - Missing email (400 Bad Request) (11.447ms)
✔ Login - Missing password (400 Bad Request) (10.3254ms)
✔ Login - Wrong password (401 Unauthorized) (15.0682ms)
✔ Login - Non-existent user (401 Unauthorized) (19.4164ms)
✔ Login - Blocked user (403 Forbidden) (15.404ms)

ℹ tests 7
ℹ pass 7
ℹ fail 0
```

All 7 smoke tests now pass.

## Key Learnings

1. **MCP Tools are effective for rapid debugging:** The three tools provided different perspectives (database state, application logs, container state) that quickly isolated the root cause.

2. **Structured Logging:** JSON logs in the application made it easy to filter and identify the exact reason for the rejection.

3. **Access Control Testing:** The smoke tests include coverage for both successful logins and access denial scenarios, which helped catch the data inconsistency.

4. **Test Data Management:** Proper test data setup (ensuring test users have correct status) is critical for test reliability.

## Screenshots

![Investigation Screenshot](screenshots/Screenshot%202026-11-01%20215928.png)
