import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import { useAuthStore } from '../stores/auth';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

describe('RegisterPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.getState().logout();
  });

  it('shows invite code when registration requires an invite', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ registrationRequiresInvite: true })));

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/invite code/i)).toBeInTheDocument();
    });
  });
});
