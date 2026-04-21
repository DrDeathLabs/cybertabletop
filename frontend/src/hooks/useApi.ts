import { useCallback } from 'react';
import { useAuthStore } from '../stores/auth';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (response.status === 401) {
    // Try refresh
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshed.ok) {
      // Retry original request
      const retry = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
      });

      if (!retry.ok) {
        const err = await retry.json().catch(() => ({ error: 'Request failed' }));
        throw new ApiError(retry.status, err.error || 'Request failed');
      }

      return retry.json();
    } else {
      // Clear auth and redirect
      useAuthStore.getState().logout();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, err.error || 'Request failed');
  }

  return response.json();
}

export function useApi() {
  const get = useCallback(<T>(url: string) => apiFetch<T>(url), []);

  const post = useCallback(
    <T>(url: string, body?: unknown) =>
      apiFetch<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
    []
  );

  const put = useCallback(
    <T>(url: string, body?: unknown) =>
      apiFetch<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
    []
  );

  const patch = useCallback(
    <T>(url: string, body?: unknown) =>
      apiFetch<T>(url, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
    []
  );

  const del = useCallback(<T>(url: string) => apiFetch<T>(url, { method: 'DELETE' }), []);

  return { get, post, put, patch, del };
}

export { ApiError };
