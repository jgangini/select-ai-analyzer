import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { getLoginErrorMessage, LoginForm, makeMonochromeOracleSvg } from './LoginForm';

describe('LoginForm helpers', () => {
  it('normalizes OCI SVG assets for monochrome rendering', () => {
    const svg = '<?xml version="1.0"?><svg viewBox="0 0 1 1"><style>.st0{}</style><path class="st1" /><path class="st0" /></svg>';

    expect(makeMonochromeOracleSvg(svg)).toContain('class="h-full w-full"');
    expect(makeMonochromeOracleSvg(svg)).toContain('fill="currentColor"');
    expect(makeMonochromeOracleSvg(svg)).not.toContain('<?xml');
    expect(makeMonochromeOracleSvg(svg)).not.toContain('<style>');
  });

  it('extracts login API details with a safe fallback', () => {
    expect(getLoginErrorMessage({ response: { data: { detail: 'Invalid credentials' } } })).toBe(
      'Invalid credentials'
    );
    expect(getLoginErrorMessage({ code: 'ECONNABORTED' })).toBe(
      'The previous sign-in attempt took too long. Please try again.'
    );
    expect(getLoginErrorMessage(new Error('Network error'))).toBe(
      'Login failed. Please check your credentials.'
    );
  });

  it('clears stale login errors when credentials are edited', async () => {
    const login = vi.fn().mockRejectedValue({ code: 'ECONNABORTED' });
    render(
      <MemoryRouter>
        <LoginForm appName="Select AI Analytics" login={login} />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'analyst@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByRole('alert');

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
