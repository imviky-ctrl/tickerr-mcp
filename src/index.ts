#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE_URL = 'https://tickerr.ai/api/v1'
const UA = 'tickerr-mcp/1.0 (https://tickerr.ai)'

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`tickerr API ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tool { slug: string; name: string; vendor: string; category_slug: string; homepage_url: string | null }

interface ToolStatus {
  tool: { slug: string; name: string; vendor: string; homepage_url: string | null }
  status: 'operational' | 'down' | 'unknown'
  is_up: boolean | null
  response_ms: number | null
  checked_at: string | null
  uptime_30d: number | null
  uptime_90d: number | null
  active_incident: { id: string; title: string; severity: string; started_at: string; source: string } | null
}

interface Incident {
  id: string; title: string; description: string | null; severity: string
  started_at: string; resolved_at: string | null; source: string
  affected_components: string[] | null; impact: string | null
}

interface PricingRow {
  tool_slug: string; tool_name: string; model_name: string; model_slug: string
  input_per_1m: number; output_per_1m: number | null; cached_input_per_1m: number | null
}

interface LimitRow { key: string; value: string; unit: string | null; notes: string | null }
interface Plan { name: string; price_usd: number | null; limits: LimitRow[] }

interface FreeTierTool {
  slug: string; name: string; category_slug: string; tier_name: string
  paidFrom: number | null
  limits: { limit_key: string; limit_value: string; limit_unit: string | null; notes: string | null }[]
}

// ── Server ─────────────────────────────────────────────────────────────────────

const server = new McpServer({ name: 'tickerr', version: '1.0.0' })

// ── list_tools ─────────────────────────────────────────────────────────────────

server.tool(
  'list_tools',
  'List all 42+ AI tools monitored by tickerr.ai — ChatGPT, Claude, Gemini, Cursor, GitHub Copilot, Perplexity, DeepSeek, Groq, Fireworks AI, and more.',
  {},
  async () => {
    const data = await fetchJSON<{ tools: Tool[]; count: number }>('/tools')
    const byCategory: Record<string, Tool[]> = {}
    for (const t of data.tools) {
      const cat = t.category_slug ?? 'other'
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(t)
    }
    const lines: string[] = [`${data.count} AI tools tracked by tickerr.ai:\n`]
    for (const [cat, tools] of Object.entries(byCategory).sort()) {
      lines.push(`**${cat}**`)
      for (const t of tools) lines.push(`  • ${t.name} (${t.slug})`)
      lines.push('')
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
  }
)

// ── get_tool_status ────────────────────────────────────────────────────────────

server.tool(
  'get_tool_status',
  'Get live operational status, uptime percentage, and response time for any AI tool. Checks every 5 minutes from independent infrastructure.',
  { slug: z.string().describe('Tool slug — e.g. "chatgpt", "claude", "cursor", "github-copilot", "gemini"') },
  async ({ slug }) => {
    const d = await fetchJSON<ToolStatus>(`/tools/${slug}/status`)
    const uptime = (label: string, pct: number | null) =>
      pct !== null ? `${label} uptime: ${pct}%` : `${label} uptime: no data`

    const lines = [
      `**${d.tool.name}** — ${d.status.toUpperCase()}`,
      d.response_ms !== null ? `Response time: ${d.response_ms}ms` : null,
      d.checked_at ? `Last checked: ${new Date(d.checked_at).toUTCString()}` : null,
      uptime('30-day', d.uptime_30d),
      uptime('90-day', d.uptime_90d),
    ].filter(Boolean) as string[]

    if (d.active_incident) {
      const i = d.active_incident
      lines.push('', `⚠️ ACTIVE INCIDENT: ${i.title}`, `  Severity: ${i.severity}`, `  Since: ${new Date(i.started_at).toUTCString()}`)
    }

    lines.push('', `Full status page: https://tickerr.ai/status/${slug}`)
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
  }
)

// ── get_incidents ──────────────────────────────────────────────────────────────

server.tool(
  'get_incidents',
  'Get historical incidents (outages, degradations) for any AI tool from the last 90 days. Sourced from 26 official provider status pages.',
  {
    slug: z.string().describe('Tool slug — e.g. "chatgpt", "claude", "gemini"'),
    limit: z.number().int().min(1).max(50).optional().describe('Number of incidents (default 10, max 50)'),
  },
  async ({ slug, limit }) => {
    const qs = limit ? `?limit=${limit}` : ''
    const d = await fetchJSON<{ tool: { slug: string; name: string }; incidents: Incident[]; count: number }>(
      `/tools/${slug}/incidents${qs}`
    )

    if (d.count === 0) {
      return { content: [{ type: 'text' as const, text: `No incidents found for ${d.tool.name} in the last 90 days.` }] }
    }

    const lines = [`**${d.tool.name}** — ${d.count} incident(s) in the last 90 days:\n`]
    for (const inc of d.incidents) {
      const resolved = inc.resolved_at ? `Resolved ${new Date(inc.resolved_at).toUTCString()}` : '🔴 ONGOING'
      const duration = inc.resolved_at
        ? ` (${Math.round((new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime()) / 60000)}m)`
        : ''
      lines.push(`### ${inc.title}`, `${inc.severity.toUpperCase()} · ${resolved}${duration}`)
      if (inc.description) lines.push(inc.description)
      if (inc.affected_components?.length) lines.push(`Affected: ${inc.affected_components.join(', ')}`)
      lines.push('')
    }
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
  }
)

// ── get_api_pricing ────────────────────────────────────────────────────────────

server.tool(
  'get_api_pricing',
  'Get current API pricing (input/output cost per 1M tokens) for AI models tracked by tickerr.ai. Filter by model or provider name.',
  {
    filter: z.string().optional().describe('Filter by model or tool name — e.g. "claude", "gpt-4o", "gemini"'),
    limit: z.number().int().min(1).max(200).optional().describe('Max models to return (default 50)'),
  },
  async ({ filter, limit = 50 }) => {
    const data = await fetchJSON<{ models: PricingRow[] }>('/pricing')
    let models = data.models
    if (filter) {
      const q = filter.toLowerCase()
      models = models.filter(
        (m) => m.model_name.toLowerCase().includes(q) || m.model_slug.toLowerCase().includes(q) || m.tool_name.toLowerCase().includes(q)
      )
    }
    models = models.slice(0, limit)

    if (models.length === 0) {
      return { content: [{ type: 'text' as const, text: `No models found${filter ? ` matching "${filter}"` : ''}.` }] }
    }

    const fmt = (n: number | null) => n !== null ? `$${n.toFixed(2)}` : 'n/a'
    const col = (s: string, w: number) => s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w)

    const header = `${col('Model', 38)} ${col('Tool', 18)} ${'In/1M'.padStart(8)} ${'Out/1M'.padStart(8)} ${'Cache/1M'.padStart(9)}`
    const sep = '─'.repeat(header.length)
    const rows = models.map((m) =>
      `${col(m.model_name, 38)} ${col(m.tool_name, 18)} ${fmt(m.input_per_1m).padStart(8)} ${fmt(m.output_per_1m).padStart(8)} ${fmt(m.cached_input_per_1m).padStart(9)}`
    )

    return {
      content: [{
        type: 'text' as const,
        text: [
          `${models.length} models (sorted cheapest input first):`,
          '', header, sep, ...rows, '',
          'Full pricing: https://tickerr.ai/pricing',
        ].join('\n'),
      }],
    }
  }
)

// ── get_rate_limits ────────────────────────────────────────────────────────────

server.tool(
  'get_rate_limits',
  'Get rate limits and plan details for any AI tool — requests per minute, tokens per day, context window, and more by plan tier.',
  { slug: z.string().describe('Tool slug — e.g. "cursor", "github-copilot", "chatgpt", "claude"') },
  async ({ slug }) => {
    const d = await fetchJSON<{ tool: { slug: string; name: string; vendor: string }; plans: Plan[] }>(
      `/tools/${slug}/limits`
    )

    if (!d.plans.length) {
      return { content: [{ type: 'text' as const, text: `No plan/limit data found for ${d.tool.name}.` }] }
    }

    const lines = [`**${d.tool.name}** plan limits:\n`]
    for (const plan of d.plans) {
      const price = plan.price_usd === 0 ? 'Free' : plan.price_usd !== null ? `$${plan.price_usd}/mo` : 'Custom'
      lines.push(`### ${plan.name} (${price})`)
      if (plan.limits.length === 0) {
        lines.push('  No limit data available')
      } else {
        for (const l of plan.limits) {
          const unit = l.unit ? ` ${l.unit}` : ''
          const note = l.notes ? ` — ${l.notes}` : ''
          lines.push(`  • ${l.key}: ${l.value}${unit}${note}`)
        }
      }
      lines.push('')
    }

    lines.push(`Full details: https://tickerr.ai/limits/${slug}`)
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
  }
)

// ── compare_pricing ────────────────────────────────────────────────────────────

server.tool(
  'compare_pricing',
  'Rank AI models by total cost for a given token workload. Useful for finding the cheapest model for your use case.',
  {
    input_tokens: z.number().int().min(1).describe('Number of input tokens per request'),
    output_tokens: z.number().int().min(0).default(0).describe('Number of output tokens per request'),
    filter: z.string().optional().describe('Narrow to a provider or model family — e.g. "claude", "gpt", "gemini"'),
    top: z.number().int().min(1).max(30).optional().describe('Show only the N cheapest models (default 10)'),
  },
  async ({ input_tokens, output_tokens, filter, top = 10 }) => {
    const data = await fetchJSON<{ models: PricingRow[] }>('/pricing')
    let models = data.models
    if (filter) {
      const q = filter.toLowerCase()
      models = models.filter(
        (m) => m.model_name.toLowerCase().includes(q) || m.tool_name.toLowerCase().includes(q)
      )
    }

    const ranked = models
      .map((m) => ({
        ...m,
        total: (input_tokens / 1_000_000) * m.input_per_1m + (m.output_per_1m !== null ? (output_tokens / 1_000_000) * m.output_per_1m : 0),
      }))
      .sort((a, b) => a.total - b.total)
      .slice(0, top)

    if (!ranked.length) {
      return { content: [{ type: 'text' as const, text: 'No models found for that filter.' }] }
    }

    const cheapest = ranked[0].total
    const fmt = (n: number) => n < 0.001 ? `$${n.toFixed(6)}` : `$${n.toFixed(4)}`
    const col = (s: string, w: number) => s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w)

    const header = `${'#'.padStart(2)}  ${col('Model', 36)} ${col('Tool', 18)} ${'Cost'.padStart(10)}  vs cheapest`
    const sep = '─'.repeat(header.length)
    const rows = ranked.map((m, i) => {
      const mult = i === 0 ? '(cheapest)' : `${(m.total / cheapest).toFixed(1)}× more`
      return `${String(i + 1).padStart(2)}  ${col(m.model_name, 36)} ${col(m.tool_name, 18)} ${fmt(m.total).padStart(10)}  ${mult}`
    })

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Cost for ${input_tokens.toLocaleString()} input + ${output_tokens.toLocaleString()} output tokens:`,
          '', header, sep, ...rows, '',
          'Full calculator: https://tickerr.ai/token-counter',
        ].join('\n'),
      }],
    }
  }
)

// ── get_free_tier ──────────────────────────────────────────────────────────────

server.tool(
  'get_free_tier',
  'Find the best free plans across AI tools, grouped by category (LLM APIs, coding assistants, image generation, etc.).',
  {
    category: z.string().optional().describe('Filter by category slug — e.g. "llm", "coding", "image", "video"'),
  },
  async ({ category }) => {
    const data = await fetchJSON<{ by_category: Record<string, FreeTierTool[]>; total: number }>('/free-tiers')

    let grouped = data.by_category
    if (category) {
      const q = category.toLowerCase()
      grouped = Object.fromEntries(
        Object.entries(grouped).filter(([cat]) => cat.toLowerCase().includes(q))
      )
    }

    const entries = Object.entries(grouped).sort()
    if (!entries.length) {
      return { content: [{ type: 'text' as const, text: `No free tiers found${category ? ` for category "${category}"` : ''}.` }] }
    }

    const lines: string[] = [`Free plans across ${data.total} AI tools:\n`]
    for (const [cat, tools] of entries) {
      lines.push(`## ${cat}`)
      for (const t of tools) {
        const paid = t.paidFrom ? ` (paid from $${t.paidFrom}/mo)` : ''
        lines.push(`\n**${t.name}**${paid}`)
        for (const l of t.limits) {
          const unit = l.limit_unit ? ` ${l.limit_unit}` : ''
          const note = l.notes ? ` — ${l.notes}` : ''
          lines.push(`  • ${l.limit_key}: ${l.limit_value}${unit}${note}`)
        }
      }
      lines.push('')
    }

    lines.push('Full free tier guide: https://tickerr.ai/free')
    return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
  }
)

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
