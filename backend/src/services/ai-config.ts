/**
 * AI Configuration Service
 *
 * Stores per-provider AI settings in PostgreSQL.
 * DB values take priority over .env vars — .env is the fallback when no DB row exists.
 * 30-second in-memory cache (same pattern as prompt-templates.ts).
 */

import { prisma } from './db';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProviderType = 'ollama' | 'anthropic' | 'openai';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  apiKey: string;        // empty string = no auth
  temperature: number;
  numPredict: number;
  numCtx: number;
}

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface OpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AISettings {
  activeProvider: ProviderType;
  ollama: OllamaConfig;
  anthropic: AnthropicConfig;
  openai: OpenAIConfig;
}

export interface ProviderRow {
  provider: ProviderType;
  isActive: boolean;
  settings: OllamaConfig | AnthropicConfig | OpenAIConfig;
  updatedAt?: string;
  updatedByEmail?: string;
}

export interface TestResult {
  success: boolean;
  latencyMs: number;
  message: string;
  models?: string[];
}

// ── Defaults (from .env — used when no DB row exists) ─────────────────────────

function envDefaults(): AISettings {
  return {
    activeProvider: (process.env.AI_PROVIDER as ProviderType) || 'ollama',
    ollama: {
      baseUrl:     process.env.OLLAMA_BASE_URL  || 'http://host.docker.internal:11434',
      model:       process.env.OLLAMA_MODEL     || 'llama3',
      apiKey:      process.env.OLLAMA_API_KEY   || '',
      temperature: 0.7,
      numPredict:  8192,
      numCtx:      16384,
    },
    anthropic: {
      apiKey:      process.env.ANTHROPIC_API_KEY || '',
      model:       process.env.CLAUDE_MODEL      || 'claude-opus-4-6',
      maxTokens:   4000,
      temperature: 0.7,
    },
    openai: {
      baseUrl:     process.env.OPENAI_BASE_URL  || '',
      apiKey:      process.env.OPENAI_API_KEY   || '',
      model:       process.env.OPENAI_MODEL     || 'gpt-4o',
      maxTokens:   4000,
      temperature: 0.7,
    },
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry { settings: AISettings; ts: number }
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 30_000;

function invalidate() { cache = null; }

// ── Core read ─────────────────────────────────────────────────────────────────

/** Merged config: DB values win over .env defaults. Cached 30 s. */
export async function getAISettings(): Promise<AISettings> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL_MS) return cache.settings;

  const rows = await prisma.aIConfig.findMany({
    include: { updatedBy: { select: { email: true } } },
  });

  const base = envDefaults();

  for (const row of rows) {
    const s = row.settings as Record<string, unknown>;
    if (row.provider === 'ollama') {
      base.ollama = { ...base.ollama, ...s } as OllamaConfig;
      // Enforce a hard floor on numPredict so that admins lowering it for inject
      // generation speed don't accidentally truncate prose scripts and feedback.
      // 8192 is the minimum safe value for any content type in this application.
      base.ollama.numPredict = Math.max(base.ollama.numPredict, 8192);
    } else if (row.provider === 'anthropic') {
      base.anthropic = { ...base.anthropic, ...s } as AnthropicConfig;
      // Same floor for Anthropic maxTokens.
      base.anthropic.maxTokens = Math.max(base.anthropic.maxTokens, 4000);
    } else if (row.provider === 'openai') {
      base.openai = { ...base.openai, ...s } as OpenAIConfig;
      base.openai.maxTokens = Math.max(base.openai.maxTokens, 4000);
    }
    if (row.isActive) base.activeProvider = row.provider as ProviderType;
  }

  cache = { settings: base, ts: now };
  return base;
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

/** All provider configs for the admin panel. */
export async function getAllProviderRows(): Promise<ProviderRow[]> {
  const rows = await prisma.aIConfig.findMany({
    include: { updatedBy: { select: { email: true } } },
  });
  const rowMap = new Map(rows.map((r) => [r.provider, r]));
  const defaults = envDefaults();

  const providers: ProviderType[] = ['ollama', 'anthropic', 'openai'];
  return providers.map((provider) => {
    const row = rowMap.get(provider);
    let settings: OllamaConfig | AnthropicConfig | OpenAIConfig;
    if (provider === 'ollama') settings = { ...defaults.ollama, ...(row?.settings as object ?? {}) };
    else if (provider === 'anthropic') settings = { ...defaults.anthropic, ...(row?.settings as object ?? {}) };
    else settings = { ...defaults.openai, ...(row?.settings as object ?? {}) };

    return {
      provider,
      isActive: row?.isActive ?? (defaults.activeProvider === provider && !rows.some((r) => r.isActive)),
      settings,
      updatedAt: row?.updatedAt?.toISOString(),
      updatedByEmail: row?.updatedBy?.email ?? undefined,
    };
  });
}

/** Save settings for a provider. Does NOT change which provider is active. */
export async function saveProviderConfig(
  provider: ProviderType,
  settings: Record<string, unknown>,
  userId: string,
): Promise<void> {
  await prisma.aIConfig.upsert({
    where: { provider },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { provider, isActive: false, settings: settings as any, updatedById: userId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { settings: settings as any, updatedById: userId },
  });
  invalidate();
}

/** Set one provider as active; deactivate all others. */
export async function setActiveProvider(provider: ProviderType, userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.aIConfig.updateMany({ where: {}, data: { isActive: false } }),
    prisma.aIConfig.upsert({
      where: { provider },
      create: { provider, isActive: true, settings: {}, updatedById: userId },
      update: { isActive: true, updatedById: userId },
    }),
  ]);
  invalidate();
}

/** Reset a provider back to env defaults by deleting its DB row. */
export async function resetProviderConfig(provider: ProviderType): Promise<void> {
  await prisma.aIConfig.deleteMany({ where: { provider } });
  invalidate();
}

// ── Connection test ───────────────────────────────────────────────────────────

export async function testProviderConnection(
  provider: ProviderType,
  settings: Record<string, unknown>,
): Promise<TestResult> {
  const start = Date.now();

  try {
    if (provider === 'ollama') {
      const baseUrl = (settings.baseUrl as string) || 'http://host.docker.internal:11434';
      const apiKey  = (settings.apiKey  as string) || '';
      const headers: Record<string, string> = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(`${baseUrl}/api/tags`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const models = data.models?.map((m) => m.name) ?? [];
      return { success: true, latencyMs: Date.now() - start, message: `Connected — ${models.length} model(s) available`, models };

    } else if (provider === 'anthropic') {
      const apiKey = (settings.apiKey as string) || '';
      if (!apiKey) return { success: false, latencyMs: 0, message: 'API key is required' };
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 100)}`);
      }
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const models = data.data?.map((m) => m.id) ?? [];
      return { success: true, latencyMs: Date.now() - start, message: `Connected — ${models.length} model(s) available`, models };

    } else if (provider === 'openai') {
      const baseUrl = (settings.baseUrl as string)?.replace(/\/$/, '') || '';
      const apiKey  = (settings.apiKey  as string) || '';
      if (!baseUrl) return { success: false, latencyMs: 0, message: 'Base URL is required' };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const models = data.data?.map((m) => m.id).slice(0, 20) ?? [];
      return { success: true, latencyMs: Date.now() - start, message: `Connected — ${models.length} model(s) found`, models };
    }

    return { success: false, latencyMs: 0, message: 'Unknown provider' };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - start, message: String(err) };
  }
}
