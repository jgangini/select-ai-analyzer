import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiKeySection,
  FinishSetupButton,
  GenerativeAISection,
  ObjectStorageSection,
} from './SelectAISetupSections';

type ApiKeyProps = Parameters<typeof ApiKeySection>[0];
type ObjectStorageProps = Parameters<typeof ObjectStorageSection>[0];
type GenerativeAIProps = Parameters<typeof GenerativeAISection>[0];

const config = {
  compartment_id: 'ocid1.compartment.oc1..demo',
  user: 'ocid1.user.oc1..demo',
  fingerprint: 'aa:bb:cc',
  tenancy: 'ocid1.tenancy.oc1..demo',
  region: 'us-chicago-1',
  key_file: 'wallet/key.pem',
  namespace: 'banknamespace',
  bucket_name: 'app_agent',
  inference_url: 'https://inference.generativeai.us-chicago-1.oci.oraclecloud.com',
  generative_model: 'meta.llama-4-maverick-17b-128e-instruct-fp8',
};

function apiKeyProps(overrides: Partial<ApiKeyProps> = {}): ApiKeyProps {
  return {
    config,
    setConfig: vi.fn(),
    dragActive: false,
    uploadingKey: false,
    keyFile: new File(['key'], 'oci_api_key.pem'),
    testResult: { success: true, message: 'Connection ok' },
    testing: false,
    saving: false,
    saved: false,
    onDrag: vi.fn(),
    onDrop: vi.fn(),
    onKeyFileChange: vi.fn(),
    onClearKeyFile: vi.fn(),
    onRegionChange: vi.fn(),
    onTest: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
}

describe('SelectAISetupSections', () => {
  afterEach(() => {
    cleanup();
  });

  it('wires API key actions and selected key file state', () => {
    const onClearKeyFile = vi.fn();
    const onTest = vi.fn();
    const onSave = vi.fn();

    render(<ApiKeySection {...apiKeyProps({ onClearKeyFile, onTest, onSave })} />);

    expect(screen.getByDisplayValue(config.compartment_id)).toBeInTheDocument();
    expect(screen.getByText('Selected File: oci_api_key.pem')).toBeInTheDocument();
    expect(screen.getByText('Key file uploaded successfully')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /clear key file/i }));
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    fireEvent.click(screen.getByRole('button', { name: /save configuration/i }));

    expect(onClearKeyFile).toHaveBeenCalledTimes(1);
    expect(onTest).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows dependency notices before dependent services can be tested', () => {
    const objectStorageProps: ObjectStorageProps = {
      config,
      setConfig: vi.fn(),
      savedApiKey: false,
      testResult: null,
      testing: false,
      saving: false,
      saved: false,
      onTest: vi.fn(),
      onSave: vi.fn(),
    };

    render(<ObjectStorageSection {...objectStorageProps} />);

    expect(screen.getByText(/before testing Object Storage/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test connection/i })).toBeDisabled();
  });

  it('updates the selected generative AI model and finish action', () => {
    const setConfig = vi.fn();
    const onFinish = vi.fn();
    const generativeAIProps: GenerativeAIProps = {
      config: { ...config, generative_model: '' },
      setConfig,
      savedApiKey: true,
      loadingModels: false,
      selectedGenerativeInList: true,
      generativeModels: [{ id: config.generative_model, display_name: 'Llama Maverick' }],
      testResult: { success: true, message: 'Model ok' },
      testing: false,
      saving: false,
      saved: false,
      onTest: vi.fn(),
      onSave: vi.fn(),
    };

    render(
      <>
        <GenerativeAISection {...generativeAIProps} />
        <FinishSetupButton disabled={false} onFinish={onFinish} />
      </>
    );

    fireEvent.change(screen.getByRole('combobox'), { target: { value: config.generative_model } });
    fireEvent.click(screen.getByRole('button', { name: /finish installation/i }));

    expect(setConfig).toHaveBeenCalledWith({ ...generativeAIProps.config, generative_model: config.generative_model });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
