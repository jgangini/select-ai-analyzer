import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import api from '../../services/httpClient';
import { DatabaseConfigStep } from './DatabaseConfigStep';

vi.mock('../../services/httpClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('DatabaseConfigStep', () => {
  it('uploads a wallet, saves a tested runtime connection, and advances with the database config', async () => {
    const onNext = vi.fn();
    vi.mocked(api.post).mockImplementation((endpoint: string) => {
      if (endpoint === '/setup/upload-wallet') {
        return Promise.resolve({
          data: {
            wallet_path: 'D:/wallet',
            dsns: ['appagent_low', 'appagent_medium'],
            selected_dsn: 'appagent_medium',
          },
        });
      }
      if (endpoint === '/setup/test-db') {
        return Promise.resolve({ data: { success: true, connected_user: 'APP_AGENT' } });
      }
      if (endpoint === '/setup/save-db-runtime') {
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.resolve({ data: {} });
    });

    render(<DatabaseConfigStep onNext={onNext} />);

    const walletInput = document.querySelector('#wallet-upload') as HTMLInputElement;
    fireEvent.change(walletInput, {
      target: { files: [new File(['wallet'], 'Wallet_APPAGENT.zip', { type: 'application/zip' })] },
    });

    await waitFor(() => expect(screen.getByText('Wallet uploaded successfully')).toBeInTheDocument());
    expect(screen.getByRole('combobox')).toHaveValue('appagent_medium');

    fireEvent.change(screen.getByLabelText(/wallet password/i), { target: { value: 'wallet-secret' } });
    fireEvent.change(screen.getByPlaceholderText('APP_AGENT'), { target: { value: 'APP_AGENT' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'db-secret' } });

    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));

    await waitFor(() => expect(screen.getByText('Database connection successful and saved for runtime')).toBeInTheDocument());
    expect(api.post).toHaveBeenCalledWith('/setup/save-db-runtime', {
      wallet_path: 'D:/wallet',
      wallet_password: 'wallet-secret',
      user: 'APP_AGENT',
      password: 'db-secret',
      dsn: 'appagent_medium',
    });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(onNext).toHaveBeenCalledWith({
      database: {
        walletPath: 'D:/wallet',
        walletPassword: 'wallet-secret',
        username: 'APP_AGENT',
        password: 'db-secret',
        dsn: 'appagent_medium',
      },
    });
  });
});
