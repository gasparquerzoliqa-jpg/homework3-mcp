import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { execSync } from "child_process";
import Database from "better-sqlite3";
import * as path from "path";

// Initialize MCP Server
const server = new Server({
  name: "bootcamp-ai-server",
  version: "1.0.0",
});

// Define tools
const tools = [
  {
    name: "get_docker_logs",
    description:
      "Get logs from a Docker container using 'docker logs' command. Supports optional filtering for specific text.",
    inputSchema: {
      type: "object",
      properties: {
        container_name: {
          type: "string",
          description: "Name of the Docker container to get logs from",
        },
        tail: {
          type: "number",
          description: "Number of lines to show from the end of logs (default: 50)",
          default: 50,
        },
        filter: {
          type: "string",
          description:
            "Optional text filter to search for in logs (e.g., 'error', '500', 'warning')",
        },
      },
      required: ["container_name"],
    },
  },
  {
    name: "query_database",
    description:
      "Execute a read-only SELECT query against the SQLite database. Only SELECT queries are allowed. Do not attempt to modify data.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute against the database",
        },
      },
      required: ["query"],
    },
  },
];

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request;

  try {
    if (name === "get_docker_logs") {
      return await getDockerLogs(
        args.container_name as string,
        args.tail as number | undefined,
        args.filter as string | undefined
      );
    } else if (name === "query_database") {
      return await queryDatabase(args.query as string);
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Tool implementations
async function getDockerLogs(
  containerName: string,
  tail: number = 50,
  filter?: string
): Promise<{ content: TextContent[]; isError?: boolean }> {
  try {
    // Validate container name (basic check)
    if (!containerName || containerName.includes(";") || containerName.includes("&&")) {
      throw new Error("Invalid container name");
    }

    // Get logs from Docker
    const command = `docker logs --tail ${tail} ${containerName}`;
    let logs = execSync(command, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });

    // Apply filter if provided
    if (filter) {
      const lines = logs.split("\n");
      const filteredLines = lines.filter((line) =>
        line.toLowerCase().includes(filter.toLowerCase())
      );
      logs = filteredLines.join("\n");
    }

    return {
      content: [
        {
          type: "text",
          text: logs || "(No logs found)",
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Failed to get Docker logs: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

async function queryDatabase(query: string): Promise<{ content: TextContent[]; isError?: boolean }> {
  try {
    // Validate query is SELECT only
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith("SELECT")) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Only SELECT queries are allowed. This is a read-only database connection.",
          },
        ],
        isError: true,
      };
    }

    // Check for dangerous keywords
    const dangerousKeywords = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE"];
    for (const keyword of dangerousKeywords) {
      if (trimmedQuery.includes(keyword)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Query contains '${keyword}'. Only SELECT queries are allowed.`,
            },
          ],
          isError: true,
        };
      }
    }

    // Resolve database path - it's in the parent directory
    const dbPath = path.join(process.cwd(), "..", "database.sqlite");

    // Open database connection (read-only)
    const db = new Database(dbPath, { readonly: true });

    try {
      // Execute query
      const statement = db.prepare(query);
      const results = statement.all();

      // Format results
      let output = "";
      if (results.length === 0) {
        output = "(No results)";
      } else {
        output = JSON.stringify(results, null, 2);
      }

      return {
        content: [
          {
            type: "text",
            text: output,
          },
        ],
      };
    } finally {
      db.close();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Database error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Bootcamp AI MCP Server started on stdio");
}

main().catch(console.error);
