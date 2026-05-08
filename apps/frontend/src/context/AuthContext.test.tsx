import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';

const userQueryKeys = { me: ['users', 'me'] as const };

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="auth-state">{auth.isAuthenticated ? auth.user?.username : 'guest'}</span>
      <button type="button" onClick={() => auth.login('nadia', 'secret')}>
        login
      </button>
      <button type="button" onClick={auth.logout}>
        logout
      </button>
    </div>
  );
}

function renderAuthProvider(authClient: Parameters<typeof AuthProvider>[0]['authClient']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider authClient={authClient} userQueryKeys={userQueryKeys}>
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores the token on login and clears it on logout', async () => {
    const user = { user_id: 7, username: 'nadia', name: 'Nadia', group_id: 0 };
    const authClient = {
      currentUser: vi.fn().mockResolvedValue({ data: user }),
      login: vi.fn().mockResolvedValue({ data: { access_token: 'token-7', user } }),
    };
    renderAuthProvider(authClient);

    expect(screen.getByTestId('auth-state')).toHaveTextContent('guest');
    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('nadia'));
    expect(localStorage.getItem('token')).toBe('token-7');

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('guest'));
    expect(localStorage.getItem('token')).toBeNull();
  });
});
