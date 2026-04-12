#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE_URL = 'https://tickerr.ai/api/v1'

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'User-Agent': 'tickerr-mcp/1.0' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`tickerr.ai API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Tool {
  slug: string
  name: string
  vendor: string
  category_slug: string
  homepage_url: string | null
}

interface ToolStatus {
  tool: { slug: string; name: string; vendor: string; homepage_url: string | null }
  status: 'operational' | 'down' | 'unknown'
  is_up: boolean | null
  response_ms: number | null
  checked_at: string | null
  uptime_30d: number | null
  uptime_90d: number | null
  active_incident: {
    id: string
    title: string
    severity: string
    started_at: string
    source: string
  } | null
}

interface Incident {
  id: string
  title: string
  description: string | null
  severity: string
  started_at: string
  resolved_at: string | null
  source: string
  affected_components: string[] | null
  impact: string | null
}

interface PricingRow {
  tool_slug: string
  tool_name: string
  model_name: string
  model_slug: string
  input_per_1m: number
  output_per_1m: number | null
  cached_input_per_1m: number | null
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'tickerr',
  version: '1.0.0',
})

// ── Tool: list_tools ─────────────────────────────────────────────────────────

server.tool(
  'list_tools',
  'List all AI tools monitored by tickerr.ai (42+ tools including ChatGPT, Claude, Gemini, Cursor, GitHub Copilot, etc.)',
  {},
  async () => {
    const data = await fetchJSON<{ tools: Tool[]; count: number }>('/tools')
    const lines = data.tools.map(
      (t) => `• ${t.name} (slug: ${t.slug}, vendor: ${t.vendor}, category: ${t.category_slug})`
    )
    return {
      content: [
        {
          type: 'text',
          text: `${data.count} monitored AI tools on tickerr.ai:\n\n${lines.join('\n')}`,
        },
      ],
    }
  }
)

// ── Tool: get_tool_status ────────────────────────────────────────────────────

server.tool(
  'get_tool_status',
  'Get the current operational status, uptime percentage, and response time for an AI tool. Use the tool slug (e.g. "chatgpt", "claude", "cursor", "github-copilot").',
  { slug: z.string().describe('Tool slug, e.g. "chatgpt", "claude", "cursor"') },
  async ({ slug }) => {
    const data = await fetchJSON<ToolStatus>(`/tools/${slug}/status`)

    const uptimeLine = (label: string, pct: number | null) =>
      pct !== null ? `${label}: ${pct}%` : `${label}: no data`

    const lines = [
      `**${data.tool.name}** (${data.tool.vendor})`,
      `Status: ${data.status.toUpperCase()}`,
      data.response_ms !== null ? `Response time: ${data.response_ms}ms` : null,
      data.checked_at ? `Last checked: ${new Date(data.checked_at).toUTCString()}` : null,
      uptimeLine('30-day uptime', data.uptime_30d),
      uptimeLine('90-day uptime', data.uptime_90d),
    ].filter(Boolean)

    if (data.active_incident) {
      const inc = data.active_incident
      lines.push(
        '',
        `⚠️ Active incident: ${inc.title}`,
        `  Severity: ${inc.severity}`,
        `  Started: ${new Date(inc.started_at).toUTCString()}`,
        `  Source: ${inc.source}`
      )
    }

    if (data.tool.homepage_url) {
      lines.push('', `More: https://tickerr.ai/status/${slug}`)
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] }
  }
)

// ── Tool: get_tool_incidents ─────────────────────────────────────────────────

server.tool(
  'get_tool_incidents',
  'Get recent incidents (outages, degradations) for an AI tool from the last 90 days.',
  {
    slug: z.string().describe('Tool slug, e.g. "chatgpt", "claude"'),
    limit: z.number().int().min(1).max(50).optional().describe('Number of incidents to return (default 10, max 50)'),
  },
  async ({ slug, limit }) => {
    const qs = limit ? `?limit=${limit}` : ''
    const data = await fetchJSON<{ tool: { slug: string; name: string }; incidents: Incident[]; count: number }>(
      `/tools/${slug}/incidents${qs}`
    )

    if (data.count === 0) {
      return {
        content: [{ type: 'text', text: `No incidents found for ${data.tool.name} in the last 90 days.` }],
      }
    }

    const lines = [`**${data.tool.name}** — ${data.count} incident(s) in the last 90 days:\n`]

    for (const inc of data.incidents) {
      const resolved = inc.resolved_at
        ? `Resolved: ${new Date(inc.resolved_at).toUTCString()}`
        : 'Status: ONGOING'
      const duration =
        inc.resolved_at
          ? `Duration: ${Math.round((new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime()) / 60000)}m`
          : null

      lines.push(
        `### ${inc.title}`,
        `Severity: ${inc.severity} | ${resolved}${duration ? ` | ${duration}` : ''}`,
        `Started: ${new Date(inc.started_at).toUTCString()}`
      )
      if (inc.description) lines.push(`Details: ${inc.description}`)
      if (inc.affected_components?.length) lines.push(`Affected: ${inc.affected_components.join(', ')}`)
      lines.push('')
    }

    return { content: [{ type: 'text', text: lines.join('\n') }] }
  }
)

// ── Tool: get_pricing ────────────────────────────────────────────────────────

server.tool(
  'get_pricing',
  'Get current API pricing for AI models tracked by tickerr.ai. Returns input/output cost per 1M tokens. Optionally filter by tool name or model name.',
  {
    filter: z
      .string()
      .optional()
      .describe('Optional filter string to search by model or tool name (case-insensitive, e.g. "claude", "gpt-4o")'),
    limit: z.number().int().min(1).max(200).optional().describe('Max number of models to return (default 50)'),
  },
  async ({ filter, limit = 50 }) => {
    const data = await fetchJSON<{ models: PricingRow[]; count: number }>('/pricing')

    let models = data.models
    if (filter) {
      const q = filter.toLowerCase()
      models = models.filter(
        (m) =>
          m.model_name.toLowerCase().includes(q) ||
          m.model_slug.toLowerCase().includes(q) ||
          m.tool_name.toLowerCase().includes(q) ||
          m.tool_slug.toLowerCase().includes(q)
      )
    }

    models = models.slice(0, limit)

    if (models.length === 0) {
      return { content: [{ type: 'text', text: `No models found${filter ? ` matching "${filter}"` : ''}.` }] }
    }

    const fmt = (n: number | null) => (n !== null ? `$${n.toFixed(2)}` : 'n/a')

    const header = `${'Model'.padEnd(40)} ${'Tool'.padEnd(20)} ${'Input/1M'.padStart(10)} ${'Output/1M'.padStart(10)} ${'Cached/1M'.padStart(10)}`
    const sep = '─'.repeat(header.length)
    const rows = models.map((m) =>
      `${m.model_name.padEnd(40)} ${m.tool_name.padEnd(20)} ${fmt(m.input_per_1m).padStart(10)} ${fmt(m.output_per_1m).padStart(10)} ${fmt(m.cached_input_per_1m).padStart(10)}`
    )

    const text = [
      `AI model pricing (${models.length} models, sorted cheapest input first):`,
      '',
      header,
      sep,
      ...rows,
      '',
      'Prices in USD per 1M tokens. Full data: https://tickerr.ai/pricing',
    ].join('\n')

    return { content: [{ type: 'text', text }] }
  }
)

// ── Tool: estimate_cost ──────────────────────────────────────────────────────

server.tool(
  'estimate_cost',
  'Estimate the API cost for a given number of input and output tokens across all tracked models. Useful for comparing costs before choosing a model.',
  {
    input_tokens: z.number().int().min(1).describe('Number of input tokens'),
    output_tokens: z.number().int().min(0).default(0).describe('Number of output tokens (default 0)'),
    filter: z.string().optional().describe('Optional filter to narrow to specific models/tools, e.g. "claude" or "gpt"'),
    top: z.number().int().min(1).max(30).optional().describe('Show only the N cheapest models (default 10)'),
  },
  async ({ input_tokens, output_tokens, filter, top = 10 }) => {
    const data = await fetchJSON<{ models: PricingRow[] }>('/pricing')

    let models = data.models
    if (filter) {
      const q = filter.toLowerCase()
      models = models.filter(
        (m) =>
          m.model_name.toLowerCase().includes(q) ||
          m.model_slug.toLowerCase().includes(q) ||
          m.tool_name.toLowerCase().includes(q)
      )
    }

    const priced = models
      .map((m) => {
        const inputCost = (input_tokens / 1_000_000) * m.input_per_1m
        const outputCost = m.output_per_1m !== null ? (output_tokens / 1_000_000) * m.output_per_1m : 0
        return { ...m, total: inputCost + outputCost }
      })
      .sort((a, b) => a.total - b.total)
      .slice(0, top)

    if (priced.length === 0) {
      return { content: [{ type: 'text', text: 'No models found for that filter.' }] }
    }

    const fmt = (n: number) => `$${n.toFixed(6)}`
    const header = `${'Model'.padEnd(40)} ${'Tool'.padEnd(20)} ${'Total cost'.padStart(12)}`
    const sep = '─'.repeat(header.length)
    const rows = priced.map((m) => `${m.model_name.padEnd(40)} ${m.tool_name.padEnd(20)} ${fmt(m.total).padStart(12)}`)

    const text = [
      `Cost estimate for ${input_tokens.toLocaleString()} input + ${output_tokens.toLocaleString()} output tokens:`,
      '',
      header,
      sep,
      ...rows,
      '',
      'Full cost calculator: https://tickerr.ai/token-counter',
    ].join('\n')

    return { content: [{ type: 'text', text }] }
  }
)

// ── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
