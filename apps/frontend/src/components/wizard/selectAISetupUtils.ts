export type GenAIModelOption = { id: string; display_name: string };

export type SelectAISetupConfig = {
  compartment_id: string;
  user: string;
  fingerprint: string;
  tenancy: string;
  region: string;
  key_file: string;
  namespace: string;
  bucket_name: string;
  inference_url: string;
  generative_model: string;
};

export type SetupResult = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

export const DEFAULT_REGION = 'us-chicago-1';
export const DEFAULT_GENAI_MODEL = 'google.gemini-2.5-flash';
export const DEFAULT_DSN = 'appagent_medium';

const PREFERRED_DSN_SUFFIXES = ['_medium', '_high', '_tp', '_low', '_tpurgent'];

export function buildInferenceUrl(region: string): string {
  const normalizedRegion = (region || '').trim().toLowerCase();
  if (!normalizedRegion) {
    return '';
  }
  return `https://inference.generativeai.${normalizedRegion}.oci.oraclecloud.com`;
}

export function createDefaultSelectAISetupConfig(): SelectAISetupConfig {
  return {
    compartment_id: '',
    user: '',
    fingerprint: '',
    tenancy: '',
    region: DEFAULT_REGION,
    key_file: '',
    namespace: '',
    bucket_name: 'app_agent',
    inference_url: buildInferenceUrl(DEFAULT_REGION),
    generative_model: DEFAULT_GENAI_MODEL,
  };
}

export function pickPreferredDsn(aliases: string[], selectedDsn?: string): string {
  const normalizedSelectedDsn = (selectedDsn || '').trim();
  if (normalizedSelectedDsn && aliases.includes(normalizedSelectedDsn)) {
    return normalizedSelectedDsn;
  }

  for (const suffix of PREFERRED_DSN_SUFFIXES) {
    const match = aliases.find((alias) => alias.toLowerCase().endsWith(suffix));
    if (match) {
      return match;
    }
  }

  return normalizedSelectedDsn || aliases[0] || DEFAULT_DSN;
}

export function pickPreferredGenAIModel(
  models: GenAIModelOption[],
  preferredModel = DEFAULT_GENAI_MODEL
): string {
  const match = models.find((model) => model.display_name === preferredModel || model.id === preferredModel);
  return match?.id || models[0]?.id || preferredModel;
}

export function isWalletZipFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.zip');
}

export function isPemKeyFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pem');
}

export function buildUploadErrorMessage(error: unknown): string {
  const maybeError = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
  };
  const status = maybeError?.response?.status;
  const detail = getUploadErrorDetail(maybeError);

  if (status && detail) return `(${status}) ${detail}`;
  if (detail) return detail;
  return 'Error al subir wallet';
}

export function getApiErrorDetail(error: unknown, fallback: string): string {
  const maybeError = error as { response?: { data?: { detail?: string } } };
  return maybeError.response?.data?.detail || fallback;
}

function getUploadErrorDetail(error: {
  response?: { data?: unknown };
  message?: string;
}): string {
  const responseData = error?.response?.data;
  if (typeof responseData === 'string') return responseData;
  if (responseData && typeof responseData === 'object') {
    const fields = responseData as Record<string, unknown>;
    if (fields.detail) return String(fields.detail);
    if (fields.message) return String(fields.message);
  }
  return error?.message ? String(error.message) : '';
}
