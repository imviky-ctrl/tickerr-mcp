# Tickerr MCP Server

Real-time AI tool intelligence for Claude, Cursor, and Claude Code.
Check if ChatGPT is down. Get live API pricing. Compare rate limits.

## What you can ask

- "Is Claude down right now?"
- "What's the cheapest LLM API for my use case?"
- "What are Cursor's rate limits on the free plan?"
- "Has OpenAI changed their pricing this month?"
- "Compare Claude Haiku vs GPT-4o Mini cost per million tokens"
- "Which AI tools have a free tier for coding assistants?"
- "Show me recent outages for GitHub Copilot"

## Tools exposed

| Tool | Description |
|------|-------------|
| `get_tool_status` | Live status + uptime % for any AI tool, checked every 5 min |
| `get_api_pricing` | Current pricing per model, sorted cheapest first |
| `get_rate_limits` | Rate limits by tool and plan tier |
| `compare_pricing` | Rank models by cost for a given token workload |
| `get_free_tier` | Best free plans by category |
| `get_incidents` | Historical incident log for any tool (last 90 days) |
| `list_tools` | All 42+ monitored tools with slugs |

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

### Cursor / Windsurf

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

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

## Data coverage

42+ AI tools tracked including ChatGPT, Claude, Gemini, Cursor,
GitHub Copilot, Perplexity, DeepSeek, Fireworks AI, Groq, Cohere, and more.

- **Status**: updated every 5 minutes from independent monitoring
- **Pricing**: updated daily from official provider documentation
- **Limits**: updated when providers announce changes
- **Incidents**: sourced from 26 official provider status pages, ~700 incidents tracked

## Data source

All data sourced from official provider documentation and live status pages.
See [tickerr.ai](https://tickerr.ai) for the full web interface.

## License

MIT
