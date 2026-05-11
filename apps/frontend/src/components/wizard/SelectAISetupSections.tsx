import type { ChangeEvent, Dispatch, DragEvent, SetStateAction } from 'react';

type ConfigSetter = Dispatch<SetStateAction<SelectAISetupConfig>>;

type GenAIModelOption = { id: string; display_name: string };

type SelectAISetupConfig = {
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

type SetupResult = {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
};

const FIELD_BLOCK_CLASS = 'mb-4';
const FIELD_LABEL_CLASS = 'block text-sm font-medium mb-1';
const SECTION_TITLE_CLASS = 'font-semibold text-lg mb-4 text-gray-800';
const TWO_COLUMN_GRID_CLASS = 'grid grid-cols-2 gap-4 mb-4';
const ACTION_BUTTON_CLASS = 'btn-secondary flex items-center gap-2';

function LoadingIcon() {
  return <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>;
}

function SuccessIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function SetupResultMessage({ result }: { result: SetupResult | null }) {
  if (!result) return null;
  return (
    <div
      className={`p-3 rounded mb-4 text-sm ${
        result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
      }`}
    >
      {result.message}
    </div>
  );
}

function ApiKeyRequiredNotice({ serviceName }: { serviceName: string }) {
  return (
    <div className="p-3 rounded mb-4 text-sm bg-yellow-50 text-yellow-800 border border-yellow-200">
      Please save API Key configuration first before testing {serviceName}.
    </div>
  );
}

function SetupActionButtons({
  testing,
  saving,
  saved,
  testDisabled,
  saveDisabled,
  onTest,
  onSave,
}: {
  testing: boolean;
  saving: boolean;
  saved: boolean;
  testDisabled: boolean;
  saveDisabled: boolean;
  onTest: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex gap-3 mb-6">
      <button
        type="button"
        onClick={onTest}
        disabled={testDisabled}
        className={ACTION_BUTTON_CLASS}
      >
        {testing ? <LoadingIcon /> : <TestIcon />}
        {testing ? 'Testing...' : 'Test connection'}
      </button>

      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className={ACTION_BUTTON_CLASS}
      >
        {saving ? <LoadingIcon /> : saved ? <SuccessIcon /> : <SaveIcon />}
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save configuration'}
      </button>
    </div>
  );
}

function TextInputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className={FIELD_BLOCK_CLASS}>
      <label className={FIELD_LABEL_CLASS}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-oracle"
        placeholder={placeholder}
      />
    </div>
  );
}

export function ApiKeySection({
  config,
  setConfig,
  dragActive,
  uploadingKey,
  keyFile,
  testResult,
  testing,
  saving,
  saved,
  onDrag,
  onDrop,
  onKeyFileChange,
  onClearKeyFile,
  onRegionChange,
  onTest,
  onSave,
}: {
  config: SelectAISetupConfig;
  setConfig: ConfigSetter;
  dragActive: boolean;
  uploadingKey: boolean;
  keyFile: File | null;
  testResult: SetupResult | null;
  testing: boolean;
  saving: boolean;
  saved: boolean;
  onDrag: (event: DragEvent) => void;
  onDrop: (event: DragEvent) => void;
  onKeyFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearKeyFile: () => void;
  onRegionChange: (region: string) => void;
  onTest: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mb-6">
      <h3 className={SECTION_TITLE_CLASS}>API Key</h3>

      <TextInputField
        label="Compartment ID *"
        value={config.compartment_id}
        onChange={(value) => setConfig({ ...config, compartment_id: value })}
        placeholder="ocid1.compartment.oc1..<>"
      />

      <div className={TWO_COLUMN_GRID_CLASS}>
        <TextInputField
          label="User *"
          value={config.user}
          onChange={(value) => setConfig({ ...config, user: value })}
          placeholder="ocid1.user.oc1..<>"
        />

        <TextInputField
          label="Finger Print *"
          value={config.fingerprint}
          onChange={(value) => setConfig({ ...config, fingerprint: value })}
          placeholder="fingerprint"
        />
      </div>

      <div className={TWO_COLUMN_GRID_CLASS}>
        <TextInputField
          label="Tenancy *"
          value={config.tenancy}
          onChange={(value) => setConfig({ ...config, tenancy: value })}
          placeholder="ocid.tenancy.oc1..<>"
        />

        <TextInputField
          label="Region *"
          value={config.region}
          onChange={onRegionChange}
          placeholder="us-chicago-1"
        />
      </div>

      <div className={FIELD_BLOCK_CLASS}>
        <label className="block text-sm font-medium mb-2">Key File (PEM) *</label>
        <div
          className={`py-4 px-6 border-2 border-dashed rounded-lg text-center transition-all ${
            dragActive
              ? 'border-oracle-red bg-red-50'
              : 'border-oracle-border bg-gray-50 hover:bg-gray-100'
          }`}
          onDragEnter={onDrag}
          onDragLeave={onDrag}
          onDragOver={onDrag}
          onDrop={onDrop}
        >
          {uploadingKey ? (
            <div className="text-gray-600">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oracle-red mx-auto mb-2"></div>
              <div>Uploading key file...</div>
            </div>
          ) : (
            <>
              <div className="text-gray-600 mb-1">
                <strong>Drag and Drop</strong>
              </div>
              <div className="text-sm text-gray-500 mb-1">Select a PEM file or drop one here</div>
              <input
                id="key-upload"
                type="file"
                accept=".pem"
                onChange={onKeyFileChange}
                className="hidden"
              />
              <label
                htmlFor="key-upload"
                className="text-oracle-blue-link hover:underline text-sm cursor-pointer"
              >
                Select file
              </label>
            </>
          )}
        </div>

        {keyFile && (
          <div className="mt-2 flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
            <span className="text-sm text-gray-600">Selected File: {keyFile.name}</span>
            <button
              type="button"
              onClick={onClearKeyFile}
              className="text-red-600 hover:text-red-800 text-xl leading-none"
              aria-label="Clear key file"
            >
              x
            </button>
          </div>
        )}

        {config.key_file && (
          <p className="mt-2 text-sm text-green-600">Key file uploaded successfully</p>
        )}
      </div>

      <SetupResultMessage result={testResult} />

      <SetupActionButtons
        testing={testing}
        saving={saving}
        saved={saved}
        testDisabled={testing || !config.key_file}
        saveDisabled={!testResult?.success || saving || saved}
        onTest={onTest}
        onSave={onSave}
      />
    </div>
  );
}

export function ObjectStorageSection({
  config,
  setConfig,
  savedApiKey,
  testResult,
  testing,
  saving,
  saved,
  onTest,
  onSave,
}: {
  config: SelectAISetupConfig;
  setConfig: ConfigSetter;
  savedApiKey: boolean;
  testResult: SetupResult | null;
  testing: boolean;
  saving: boolean;
  saved: boolean;
  onTest: () => void;
  onSave: () => void;
}) {
  return (
    <div className="mb-6">
      <h3 className={SECTION_TITLE_CLASS}>Object Storage</h3>

      <TextInputField
        label="Namespace *"
        value={config.namespace}
        onChange={(value) => setConfig({ ...config, namespace: value })}
        placeholder="Namespace"
      />

      <TextInputField
        label="Bucket Name *"
        value={config.bucket_name}
        onChange={(value) => setConfig({ ...config, bucket_name: value })}
        placeholder="app_agent"
      />

      {!savedApiKey && <ApiKeyRequiredNotice serviceName="Object Storage" />}

      <SetupResultMessage result={testResult} />

      <SetupActionButtons
        testing={testing}
        saving={saving}
        saved={saved}
        testDisabled={testing || !savedApiKey || !config.namespace || !config.bucket_name}
        saveDisabled={!testResult?.success || saving || saved}
        onTest={onTest}
        onSave={onSave}
      />
    </div>
  );
}

export function GenerativeAISection({
  config,
  setConfig,
  savedApiKey,
  loadingModels,
  selectedGenerativeInList,
  generativeModels,
  testResult,
  testing,
  saving,
  saved,
  onTest,
  onSave,
}: {
  config: SelectAISetupConfig;
  setConfig: ConfigSetter;
  savedApiKey: boolean;
  loadingModels: boolean;
  selectedGenerativeInList: boolean;
  generativeModels: GenAIModelOption[];
  testResult: SetupResult | null;
  testing: boolean;
  saving: boolean;
  saved: boolean;
  onTest: () => void;
  onSave: () => void;
}) {
  const modelPlaceholder = loadingModels
    ? 'Loading...'
    : !savedApiKey
      ? 'Save API Key first'
      : generativeModels.length === 0
        ? 'No models in tenant'
        : 'Select model';

  return (
    <div className="mb-6">
      <h3 className={SECTION_TITLE_CLASS}>Generative AI</h3>

      <div className={FIELD_BLOCK_CLASS}>
        <label className={FIELD_LABEL_CLASS}>Inference URL</label>
        <div className="input-oracle bg-gray-50 text-gray-700">
          {config.inference_url || 'Not available'}
        </div>
        <p className="mt-1 text-xs text-gray-600">
          Automatically derived from OCI region.
        </p>
      </div>

      <div className={FIELD_BLOCK_CLASS}>
        <label className={FIELD_LABEL_CLASS}>Generative AI Model *</label>
        <select
          value={config.generative_model}
          onChange={(event) => setConfig({ ...config, generative_model: event.target.value })}
          className="input-oracle w-full"
          disabled={loadingModels || !savedApiKey}
        >
          <option value="">{modelPlaceholder}</option>
          {!selectedGenerativeInList && config.generative_model && (
            <option value={config.generative_model}>{config.generative_model}</option>
          )}
          {generativeModels.map((model) => (
            <option key={model.id} value={model.id}>{model.display_name}</option>
          ))}
        </select>
      </div>

      <SetupResultMessage result={testResult} />

      {!savedApiKey && <ApiKeyRequiredNotice serviceName="Generative AI" />}

      <SetupActionButtons
        testing={testing}
        saving={saving}
        saved={saved}
        testDisabled={testing || !config.inference_url?.trim() || !config.generative_model?.trim()}
        saveDisabled={!testResult?.success || saving || saved}
        onTest={onTest}
        onSave={onSave}
      />
    </div>
  );
}

export function FinishSetupButton({
  disabled,
  onFinish,
}: {
  disabled: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="flex justify-end mt-8">
      <button
        type="button"
        onClick={onFinish}
        disabled={disabled}
        className="btn-primary"
        title={disabled ? 'Save all three configurations (API Key, Object Storage, and Generative AI) to continue' : undefined}
      >
        Finish Installation
      </button>
    </div>
  );
}
