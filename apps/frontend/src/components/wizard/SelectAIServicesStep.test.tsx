import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../context/ToastContext';
import api from '../../services/httpClient';
import { SelectAIServicesStep } from './SelectAIServicesStep';

vi.mock('../../services/httpClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function renderStep(onSetupComplete = vi.fn()) {
  return {
    onSetupComplete,
    ...render(
      <MemoryRouter>
        <ToastProvider>
          <SelectAIServicesStep onSetupComplete={onSetupComplete} />
        </ToastProvider>
      </MemoryRouter>
    ),
  };
}

function section(name: string) {
  return screen.getByRole('heading', { name }).closest('div') as HTMLElement;
}

describe('SelectAIServicesStep', () => {
  it('runs the OCI, Object Storage, and Generative AI setup flow before finishing', async () => {
    const onSetupComplete = vi.fn();
    vi.mocked(api.post).mockImplementation((endpoint: string) => {
      if (endpoint === '/setup/upload-key') {
        return Promise.resolve({ data: { key_path: 'wallet/oci_api_key.pem' } });
      }
      return Promise.resolve({ data: { success: true, message: 'Connection ok' } });
    });
    vi.mocked(api.get).mockResolvedValue({
      data: {
        generative_models: [
          { id: 'meta.llama-4-maverick-17b-128e-instruct-fp8', display_name: 'Llama Maverick' },
        ],
      },
    });

    renderStep(onSetupComplete);

    const keyInput = document.querySelector('#key-upload') as HTMLInputElement;
    fireEvent.change(keyInput, {
      target: { files: [new File(['key'], 'oci_api_key.pem', { type: 'application/x-pem-file' })] },
    });
    await waitFor(() => expect(screen.getByText('Key file uploaded successfully')).toBeInTheDocument());

    const apiKeySection = section('API Key');
    fireEvent.click(within(apiKeySection).getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(within(apiKeySection).getByText('Connection ok')).toBeInTheDocument());
    fireEvent.click(within(apiKeySection).getByRole('button', { name: /save configuration/i }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/setup/list-genai-models'));

    const objectStorageSection = section('Object Storage');
    fireEvent.change(screen.getByPlaceholderText('Namespace'), { target: { value: 'banknamespace' } });
    fireEvent.click(within(objectStorageSection).getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(within(objectStorageSection).getByText('Connection ok')).toBeInTheDocument());
    fireEvent.click(within(objectStorageSection).getByRole('button', { name: /save configuration/i }));
    await waitFor(() => expect(within(objectStorageSection).getByRole('button', { name: /saved/i })).toBeDisabled());

    const generativeSection = section('Generative AI');
    await waitFor(() => expect(within(generativeSection).getByRole('combobox')).not.toBeDisabled());
    fireEvent.click(within(generativeSection).getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(within(generativeSection).getByText('Connection ok')).toBeInTheDocument());
    fireEvent.click(within(generativeSection).getByRole('button', { name: /save configuration/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /finish installation/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /finish installation/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/setup/complete'));
    expect(onSetupComplete).toHaveBeenCalledTimes(1);
  });
});
