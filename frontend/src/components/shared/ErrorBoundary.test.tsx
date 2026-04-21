import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function BrokenChild(): React.ReactElement {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('shows a recoverable fallback instead of blanking the app', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const preventExpectedError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', preventExpectedError);

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    );
    window.removeEventListener('error', preventExpectedError);

    expect(screen.getByText('CyberTabletop hit an error')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh app/i })).toBeInTheDocument();
  });
});
