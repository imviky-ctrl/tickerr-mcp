# Tickerr MCP Server

Real-time AI tool intelligence for Claude, Cursor, Windsurf, and Claude Code.
Monitor 90+ AI tools, compare pricing across 300+ LLM models, check live inference latency, and route to the best model for your workload — directly in your AI agent.

## What you can ask

- "Is Claude down right now?"
- "What's the cheapest model for summarization under $1/M tokens?"
- "What are the p95 latency numbers for Gemini 2.0 Flash?"
- "Compare Claude Haiku vs GPT-4o Mini cost for 10K input, 2K output"
- "What are Cursor's rate limits on the free plan?"
- "Show me recent outages for GitHub Copilot"
- "Which AI tools have a free tier for coding?"
- "Route me to the fastest model under $3/M tokens right now"

## Tools

| Tool | Description |
|------|-------------|
| `get_tool_status` | Live status, uptime %, and response time for any AI tool — checked every 5 min |
| `get_incidents` | Historical incidents and outages for any AI tool (last 90 days) |
| `get_api_pricing` | Current API pricing per model for any provider, sorted cheapest first |
| `get_model_performance` | p50/p95 TTFT latency and tokens/sec for specific models — useful for routing |
| `get_rate_limits` | Rate limits and plan details by tier for any AI tool |
| `compare_pricing` | Rank models by total cost for a given input/output token workload |
| `get_free_tier` | Best free plans across AI tools, grouped by category |
| `list_tools` | List all 90+ monitored tools with their slugs |

## Installation

### Claude Code (CLI) — HTTP, recommended

```bash
claude mcp add tickerr --transport http --url https://tickerr.ai/mcp
```

### Cursor / Windsurf — HTTP

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "tickerr": {
      "url": "https://tickerr.ai/mcp"
    }
  }
}
```

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

### Claude Code (CLI) — npm/stdio alternative

```bash
claude mcp add tickerr -- npx -y tickerr-mcp
```

## Data coverage

90+ AI tools tracked including ChatGPT, Claude, Gemini, Grok, Cursor, GitHub Copilot,
Perplexity, DeepSeek, Fireworks AI, Groq, Cohere, Mistral, and more.

- **Status**: updated every 5 minutes from independent monitoring
- **LLM pricing**: 300+ models with per-model input/output token pricing
- **Inference benchmarks**: p50/p95 TTFT and tokens/sec per model
- **Rate limits**: updated when providers announce changes
- **Incidents**: sourced from 30+ official provider status pages, 1,000+ incidents tracked

Full model pages with pricing history and latency trends at [tickerr.ai/models](https://tickerr.ai/models).

## Data source

All data sourced from official provider documentation and live status pages.
See [tickerr.ai](https://tickerr.ai) for the full web interface.

## License

MIT
