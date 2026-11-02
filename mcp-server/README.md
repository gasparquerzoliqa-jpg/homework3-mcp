# Bootcamp MCP Server

MCP (Model Context Protocol) server for the AI bootcamp project with tools for Docker logs and database queries.

## Setup

### Prerequisites
- Node.js 18+
- Docker Desktop running with auth-service container
- Docker CLI accessible in PATH

### Installation

```bash
cd mcp-server
npm install
```

### Registration with Claude Code

Register the MCP server with Claude Code:

```bash
claude mcp add bootcamp-mcp stdio /c/Users/Gaspar/Documents/AI\ CURSO/ai-bootcamp-2/mcp-server/server.js
```

Replace the path with the absolute path to your server.js file on your system.

### Verify Registration

```bash
/mcp
```

Should list `bootcamp-mcp` with two tools: `get_docker_logs` and `query_database`.

## Tools

### 1. get_docker_logs

Retrieve logs from a Docker container with optional filtering.

**Parameters:**
- `container` (string, default: "auth-service") - Docker container name
- `tail` (number, default: 100) - Number of lines to show from the end
- `filter` (string, optional) - Case-insensitive text to filter by (e.g., "error", "500", "user_blocked")

**Example:**
```
Get logs from auth-service filtered for errors:
get_docker_logs(container="auth-service", tail=50, filter="error")
```

### 2. query_database

Execute read-only SELECT queries against the SQLite database inside the container.

**Parameters:**
- `sql` (string, required) - SQL SELECT query

**Restrictions:**
- Only SELECT statements allowed
- No INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, PRAGMA, ATTACH, DETACH
- Single statement only (no multiple statements separated by semicolons)
- Query runs inside the container using `docker exec`

**Example:**
```
Get all users:
query_database(sql="SELECT * FROM users")

Count users:
query_database(sql="SELECT COUNT(*) as count FROM users")

Get active users:
query_database(sql="SELECT email, status FROM users WHERE status = 'active'")
```

## Architecture

- **Transport:** stdio (standard input/output)
- **Framework:** @modelcontextprotocol/sdk
- **Validation:** zod
- **Execution:** 
  - Docker logs: Uses `docker logs` command
  - Database queries: Uses `docker exec auth-service node -e ...` to run queries inside the container (avoids Windows sqlite3 compilation issues)

## Testing

Start the auth-service container first:

```bash
docker-compose up -d
```

Then test the tools using Claude Code or directly:

```bash
# Manual test (requires MCP client)
/mcp
# Then call the tools
```

## Notes

- The database query tool runs inside the Docker container to avoid sqlite3 native module compilation issues on Windows
- All queries are validated to be read-only SELECT statements
- Filter matching is case-insensitive
- Docker container name defaults to "auth-service" but can be customized
