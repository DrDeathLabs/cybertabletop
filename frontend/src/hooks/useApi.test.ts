import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './useApi';
import { useAuthStore } from '../stores/auth';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    useAuthStore.getState().setUser({
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'User',
      role: 'PLAYER',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
  });

  it('returns JSON from successful requests and includes credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/example')).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/example', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }));
  });

  it('refreshes once after a 401 and retries the original request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ data: 'retried' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/protected')).resolves.toEqual({ data: 'retried' });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/refresh', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/protected', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('throws ApiError with server message for failed requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'Nope' }, { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/forbidden')).rejects.toMatchObject({
      status: 403,
      message: 'Nope',
    });
  });

  it('handles empty successful responses without throwing a JSON parse error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/no-content')).resolves.toBeUndefined();
  });
});
