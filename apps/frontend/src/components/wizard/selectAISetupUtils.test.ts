import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DSN,
  DEFAULT_GENAI_MODEL,
  DEFAULT_REGION,
  buildInferenceUrl,
  buildUploadErrorMessage,
  createDefaultSelectAISetupConfig,
  getApiErrorDetail,
  isPemKeyFile,
  isWalletZipFile,
  pickPreferredGenAIModel,
  pickPreferredDsn,
} from './selectAISetupUtils';

describe('selectAISetupUtils', () => {
  it('builds OCI Generative AI inference URLs from normalized regions', () => {
    expect(buildInferenceUrl(' US-CHICAGO-1 ')).toBe(
      'https://inference.generativeai.us-chicago-1.oci.oraclecloud.com'
    );
  });

  it('returns an empty inference URL when no region is available', () => {
    expect(buildInferenceUrl('   ')).toBe('');
  });

  it('creates the default setup config used by the wizard', () => {
    expect(createDefaultSelectAISetupConfig()).toMatchObject({
      region: DEFAULT_REGION,
      bucket_name: 'app_agent',
      inference_url: buildInferenceUrl(DEFAULT_REGION),
      generative_model: DEFAULT_GENAI_MODEL,
    });
  });

  it('selects the preferred wallet DSN alias without dropping a valid selected alias', () => {
    expect(pickPreferredDsn(['appagent_low', 'appagent_medium'], 'appagent_low')).toBe('appagent_low');
    expect(pickPreferredDsn(['appagent_high', 'appagent_medium', 'appagent_tp'])).toBe('appagent_medium');
    expect(pickPreferredDsn(['custom_alias'], 'missing_alias')).toBe('missing_alias');
    expect(pickPreferredDsn(['custom_alias'])).toBe('custom_alias');
    expect(pickPreferredDsn([])).toBe(DEFAULT_DSN);
  });

  it('selects the configured GenAI model id from available models', () => {
    expect(
      pickPreferredGenAIModel([
        { id: 'cohere.command-r-plus', display_name: 'Command R+' },
        { id: 'google.gemini-2.5-flash', display_name: 'Gemini Flash' },
      ])
    ).toBe(DEFAULT_GENAI_MODEL);
    expect(
      pickPreferredGenAIModel([
        { id: 'model-1', display_name: DEFAULT_GENAI_MODEL },
      ])
    ).toBe('model-1');
    expect(pickPreferredGenAIModel([])).toBe(DEFAULT_GENAI_MODEL);
  });

  it('uses the first available GenAI model when the old default is unavailable', () => {
    expect(
      pickPreferredGenAIModel([
        { id: 'meta.llama-4-maverick', display_name: 'Meta Llama 4 Maverick' },
        { id: 'cohere.command-r-plus', display_name: 'Command R+' },
      ])
    ).toBe('meta.llama-4-maverick');
  });

  it('accepts wallet ZIP filenames case-insensitively', () => {
    expect(isWalletZipFile('Wallet_APPAGENT.ZIP')).toBe(true);
    expect(isWalletZipFile('wallet.pem')).toBe(false);
  });

  it('accepts PEM key filenames case-insensitively', () => {
    expect(isPemKeyFile('OCI_API_KEY.PEM')).toBe(true);
    expect(isPemKeyFile('wallet.zip')).toBe(false);
  });

  it('formats database wallet upload errors from common API response shapes', () => {
    expect(buildUploadErrorMessage({ response: { status: 400, data: { detail: 'Invalid wallet' } } })).toBe(
      '(400) Invalid wallet'
    );
    expect(buildUploadErrorMessage({ response: { data: { message: 'Upload failed' } } })).toBe('Upload failed');
    expect(buildUploadErrorMessage({ message: 'Network Error' })).toBe('Network Error');
  });

  it('extracts API detail messages with a fallback', () => {
    expect(getApiErrorDetail({ response: { data: { detail: 'OCI validation failed' } } }, 'Failed')).toBe(
      'OCI validation failed'
    );
    expect(getApiErrorDetail(new Error('Network Error'), 'Failed')).toBe('Failed');
  });
});
