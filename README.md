# tickerr-mcp

MCP server for [tickerr.ai](https://tickerr.ai) — gives AI assistants real-time access to:

- **Operational status** of 42+ AI tools (ChatGPT, Claude, Gemini, Cursor, GitHub Copilot, etc.)
- **Uptime history** — 30-day and 90-day uptime percentages from independent monitoring
- **Incidents** — outage and degradation history for the last 90 days
- **API pricing** — current input/output cost per 1M tokens for all tracked models
- **Cost estimation** — compare what a workload costs across models

Data is sourced from tickerr.ai's independent monitoring infrastructure (checks every 5 minutes, 26 incident providers, ~700 incidents tracked).

## Tools

| Tool | Description |
|------|-------------|
| `list_tools` | List all monitored AI tools |
| `get_tool_status` | Current status, uptime %, response time for a tool |
| `get_tool_incidents` | Recent incidents (last 90 days) for a tool |
| `get_pricing` | API pricing for all/filtered models |
| `estimate_cost` | Compare cost of a token workload across models |

## Installation

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tickerr": {
      "command": "npx",
      "args": ["-y", "tickerr-mcp"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add tickerr -- npx -y tickerr-mcp
```

### Cursor

Add to `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "tickerr": {
      "command": "npx",
      "args": ["-y", "tickerr-mcp"]
    }
  }
}
```

## Usage examples

Once connected, you can ask your AI assistant:

- *"Is ChatGPT currently operational?"*
- *"What's Claude's 90-day uptime?"*
- *"Show me recent outages for GitHub Copilot"*
- *"Which model is cheapest for my 10k token prompt?"*
- *"Compare GPT-4o and Claude Sonnet pricing"*
- *"Estimate cost for 1M input tokens across all Anthropic models"*

## Development

```bash
npm install
npm run build
npm start
```

To test locally with Claude Desktop, point the config at the built file:

```json
{
  "mcpServers": {
    "tickerr": {
      "command": "node",
      "args": ["/absolute/path/to/tickerr-mcp/dist/index.js"]
    }
  }
}
```

## Data source

All data is served from the tickerr.ai public API (`https://tickerr.ai/api/v1`). No API key required. Rate limits apply.

## License

MIT
