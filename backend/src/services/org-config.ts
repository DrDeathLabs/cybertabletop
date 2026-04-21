import { prisma } from './db';
import { Prisma } from '@prisma/client';
import dns from 'dns/promises';
import net from 'net';

export interface OrgConfig {
  organizationName: string;
  websiteUrl: string;
  websiteSummary: string;
  websiteLastFetchedAt: string | null;
  websiteFetchError: string;
  roleNames: string[];
  divisionNames: string[];
  orgContextNotes: string;
}

export interface OrgConfigWithOrgName extends OrgConfig {
  isConfigured: boolean;
}

export interface OrgConfigInput {
  organizationName?: string;
  websiteUrl?: string;
  roleNames?: string[];
  divisionNames?: string[];
  orgContextNotes?: string;
}

const EMPTY_ORG_CONFIG: OrgConfig = {
  organizationName: '',
  websiteUrl: '',
  websiteSummary: '',
  websiteLastFetchedAt: null,
  websiteFetchError: '',
  roleNames: [],
  divisionNames: [],
  orgContextNotes: '',
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const cleaned = entry.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned.slice(0, 120));
  }

  return result.slice(0, 20);
}

function normalizeOrgConfig(raw: unknown): OrgConfig {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    organizationName: normalizeString(data.organizationName).slice(0, 120),
    websiteUrl: normalizeString(data.websiteUrl),
    websiteSummary: normalizeString(data.websiteSummary),
    websiteLastFetchedAt:
      typeof data.websiteLastFetchedAt === 'string' && data.websiteLastFetchedAt.trim()
        ? data.websiteLastFetchedAt
        : null,
    websiteFetchError: normalizeString(data.websiteFetchError),
    roleNames: normalizeStringArray(data.roleNames),
    divisionNames: normalizeStringArray(data.divisionNames),
    orgContextNotes: normalizeString(data.orgContextNotes).slice(0, 2000),
  };
}

function normalizeSettings(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === 'host.docker.internal'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local');
}

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    return a === 10
      || a === 127
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254)
      || a === 0
      || a >= 224;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }

  return true;
}

async function assertSafeExternalHttpUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Website URL must be a valid http:// or https:// URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Website URL must begin with http:// or https://');
  }

  if (url.username || url.password) {
    throw new Error('Website URL must not include embedded credentials');
  }

  if (isPrivateHostname(url.hostname)) {
    throw new Error('Website URL cannot target localhost or private hostnames');
  }

  if (net.isIP(url.hostname) && isPrivateIp(url.hostname)) {
    throw new Error('Website URL cannot target private or loopback addresses');
  }

  const addresses = await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error('Website URL cannot resolve to private or loopback addresses');
  }

  return url;
}

export function hasConfiguredOrgContext(config: OrgConfig): boolean {
  return Boolean(
    config.organizationName
    || config.websiteUrl
    || config.roleNames.length
    || config.divisionNames.length
    || config.orgContextNotes
    || config.websiteSummary,
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMeta(html: string, key: string, attr: 'name' | 'property' = 'name'): string {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i',
  );
  return html.match(pattern)?.[1]?.trim() ?? '';
}

async function fetchWebsiteSummary(websiteUrl: string): Promise<{
  summary: string;
  fetchedAt: string;
  error: string;
}> {
  let url = await assertSafeExternalHttpUrl(websiteUrl);
  let response: Response | null = null;

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Upgrade-Insecure-Requests': '1',
    },
    signal: AbortSignal.timeout(10_000),
    redirect: 'manual',
  });

    if (![301, 302, 303, 307, 308].includes(response.status)) break;

    const location = response.headers.get('location');
    if (!location) break;
    url = await assertSafeExternalHttpUrl(new URL(location, url).toString());
  }

  if (!response) {
    throw new Error('Website fetch failed');
  }

  if (!response.ok) {
    throw new Error(`Website fetch returned HTTP ${response.status}`);
  }

  const html = await response.text();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const description =
    extractMeta(html, 'description')
    || extractMeta(html, 'og:description', 'property')
    || extractMeta(html, 'twitter:description', 'name');
  const stripped = stripHtml(html);
  const contentSnippet = stripped.slice(0, 1800);

  const parts = [
    title ? `Website title: ${title}.` : '',
    description ? `Meta description: ${description}.` : '',
    contentSnippet ? `Page content excerpt: ${contentSnippet}` : '',
  ].filter(Boolean);

  return {
    summary: parts.join(' ').trim().slice(0, 2400),
    fetchedAt: new Date().toISOString(),
    error: '',
  };
}

export async function getOrgConfig(orgId: string): Promise<OrgConfigWithOrgName> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, settings: true },
  });

  if (!org) throw new Error('Organization not found');

  const settings = normalizeSettings(org.settings);
  const config = normalizeOrgConfig(settings.orgConfig);

  return {
    ...config,
    isConfigured: hasConfiguredOrgContext(config),
  };
}

export function emptyOrgConfig(organizationName = ''): OrgConfigWithOrgName {
  return {
    ...EMPTY_ORG_CONFIG,
    organizationName,
    isConfigured: false,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'organization';
}

async function makeUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let counter = 2;

  while (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
}

async function ensureOrganizationForUser(userId: string, organizationName: string): Promise<{ id: string; name: string; settings: Prisma.JsonValue }> {
  const trimmedName = normalizeString(organizationName);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  });
  const fallbackName =
    trimmedName
    || normalizeString(user?.displayName)
    || normalizeString(user?.email).split('@')[0]
    || `Organization ${userId.slice(0, 8)}`;

  const slug = await makeUniqueSlug(fallbackName);
  const org = await prisma.organization.create({
    data: {
      name: fallbackName,
      slug,
      settings: {} as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, name: true, settings: true },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { orgId: org.id },
  });

  return org;
}

export async function getOrgConfigForUser(userId: string, orgId: string | null | undefined): Promise<OrgConfigWithOrgName> {
  if (orgId) return getOrgConfig(orgId);
  return emptyOrgConfig();
}

export async function saveOrgConfigForUser(
  userId: string,
  orgId: string | null | undefined,
  input: OrgConfigInput,
): Promise<OrgConfigWithOrgName> {
  const normalizedInput = {
    organizationName: normalizeString(input.organizationName).slice(0, 120),
    websiteUrl: normalizeString(input.websiteUrl),
    roleNames: normalizeStringArray(input.roleNames),
    divisionNames: normalizeStringArray(input.divisionNames),
    orgContextNotes: normalizeString(input.orgContextNotes).slice(0, 2000),
  };

  const hasAnyInput = Boolean(
    normalizedInput.organizationName
    || normalizedInput.websiteUrl
    || normalizedInput.roleNames.length
    || normalizedInput.divisionNames.length
    || normalizedInput.orgContextNotes,
  );

  if (!orgId && !hasAnyInput) {
    return emptyOrgConfig();
  }

  const orgRecord = orgId
    ? await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, settings: true },
      })
    : null;
  const org = orgRecord ?? await ensureOrganizationForUser(userId, normalizedInput.organizationName);

  const currentSettings = normalizeSettings(org.settings);
  const currentConfig = normalizeOrgConfig(currentSettings.orgConfig);

  const nextConfig: OrgConfig = {
    ...currentConfig,
    organizationName: normalizedInput.organizationName,
    websiteUrl: normalizedInput.websiteUrl,
    roleNames: normalizedInput.roleNames,
    divisionNames: normalizedInput.divisionNames,
    orgContextNotes: normalizedInput.orgContextNotes,
  };

  if (nextConfig.websiteUrl && !isValidHttpUrl(nextConfig.websiteUrl)) {
    throw new Error('Website URL must begin with http:// or https://');
  }

  if (!nextConfig.websiteUrl) {
    nextConfig.websiteSummary = '';
    nextConfig.websiteLastFetchedAt = null;
    nextConfig.websiteFetchError = '';
  } else {
    try {
      const website = await fetchWebsiteSummary(nextConfig.websiteUrl);
      nextConfig.websiteSummary = website.summary;
      nextConfig.websiteLastFetchedAt = website.fetchedAt;
      nextConfig.websiteFetchError = '';
    } catch (error) {
      nextConfig.websiteLastFetchedAt = new Date().toISOString();
      nextConfig.websiteFetchError =
        error instanceof Error ? error.message.slice(0, 500) : 'Failed to fetch website';
    }
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      settings: {
        ...currentSettings,
        orgConfig: nextConfig,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    ...nextConfig,
    isConfigured: hasConfiguredOrgContext(nextConfig),
  };
}

export async function buildMergedAiContext(
  orgId: string | null | undefined,
  sessionContext?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const base = sessionContext ? { ...sessionContext } : {};
  if (!orgId) return base;

  const orgConfig = await getOrgConfig(orgId);
  if (!orgConfig.isConfigured) return base;

  const merged = { ...base } as Record<string, unknown>;
  if (orgConfig.organizationName) merged.orgName = orgConfig.organizationName;
  if (orgConfig.roleNames.length) merged.rolesPresent = orgConfig.roleNames;
  if (orgConfig.divisionNames.length) merged.divisionNames = orgConfig.divisionNames;
  if (orgConfig.websiteUrl) merged.orgWebsite = orgConfig.websiteUrl;
  if (orgConfig.websiteSummary) merged.websiteSummary = orgConfig.websiteSummary;
  if (orgConfig.orgContextNotes) merged.orgContextNotes = orgConfig.orgContextNotes;

  return merged;
}
