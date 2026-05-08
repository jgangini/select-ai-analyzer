import { useEffect, useState, type ChangeEvent, type Dispatch, type DragEvent, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';

import { useToast } from '../../context/ToastContext';
import api from '../../services/httpClient';
import {
  ApiKeySection,
  FinishSetupButton,
  GenerativeAISection,
  ObjectStorageSection,
} from './SelectAISetupSections';
import {
  DEFAULT_GENAI_MODEL,
  buildInferenceUrl,
  createDefaultSelectAISetupConfig,
  getApiErrorDetail,
  isPemKeyFile,
  pickPreferredGenAIModel,
  type GenAIModelOption,
  type SelectAISetupConfig,
  type SetupResult,
} from './selectAISetupUtils';

interface SelectAIServicesStepProps {
  onSetupComplete?: () => void;
}

type BooleanSetter = Dispatch<SetStateAction<boolean>>;
type ResultSetter = Dispatch<SetStateAction<SetupResult | null>>;

async function runSetupTest({
  endpoint,
  payload,
  setTesting,
  setResult,
  failureMessage,
}: {
  endpoint: string;
  payload: unknown;
  setTesting: BooleanSetter;
  setResult: ResultSetter;
  failureMessage: string;
}) {
  setTesting(true);
  setResult(null);
  try {
    const response = await api.post(endpoint, payload);
    setResult({ success: true, ...response.data });
  } catch (error: unknown) {
    setResult({
      success: false,
      message: getApiErrorDetail(error, failureMessage),
    });
  } finally {
    setTesting(false);
  }
}

async function saveSetupConfig({
  endpoint,
  payload,
  canSave,
  validationMessage,
  failureMessage,
  setSaving,
  setSaved,
}: {
  endpoint: string;
  payload: unknown;
  canSave: boolean;
  validationMessage: string;
  failureMessage: string;
  setSaving: BooleanSetter;
  setSaved: BooleanSetter;
}) {
  if (!canSave) {
    alert(validationMessage);
    return;
  }

  setSaving(true);
  try {
    await api.post(endpoint, payload);
    setSaved(true);
  } catch (error: unknown) {
    alert(`Error: ${getApiErrorDetail(error, failureMessage)}`);
  } finally {
    setSaving(false);
  }
}

export function SelectAIServicesStep({ onSetupComplete }: SelectAIServicesStepProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [config, setConfig] = useState<SelectAISetupConfig>(() => createDefaultSelectAISetupConfig());
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [uploadingKey, setUploadingKey] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [testingDU, setTestingDU] = useState(false);
  const [testResultDU, setTestResultDU] = useState<SetupResult | null>(null);
  const [savingDU, setSavingDU] = useState(false);
  const [savedDU, setSavedDU] = useState(false);

  const [testingOS, setTestingOS] = useState(false);
  const [testResultOS, setTestResultOS] = useState<SetupResult | null>(null);
  const [savingOS, setSavingOS] = useState(false);
  const [savedOS, setSavedOS] = useState(false);

  const [testingGenAI, setTestingGenAI] = useState(false);
  const [testResultGenAI, setTestResultGenAI] = useState<SetupResult | null>(null);
  const [savingGenAI, setSavingGenAI] = useState(false);
  const [savedGenAI, setSavedGenAI] = useState(false);

  const [generativeModels, setGenerativeModels] = useState<GenAIModelOption[]>([]);
  const [loadingGenAIModels, setLoadingGenAIModels] = useState(false);

  const selectedGenerativeInList = generativeModels.some(
    (model) => model.id === config.generative_model
  );

  useEffect(() => {
    if (!savedDU) return;
    let cancelled = false;
    setLoadingGenAIModels(true);

    api.get('/setup/list-genai-models')
      .then((response) => {
        if (cancelled) return;
        const genList = response.data.generative_models || [];
        setGenerativeModels(genList);
        setConfig((previous) => ({
          ...previous,
          generative_model: pickPreferredGenAIModel(genList),
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setGenerativeModels([]);
        setConfig((previous) => ({
          ...previous,
          generative_model: DEFAULT_GENAI_MODEL,
        }));
      })
      .finally(() => {
        if (!cancelled) setLoadingGenAIModels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [savedDU]);

  const uploadKeyFile = async (file: File) => {
    setUploadingKey(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/setup/upload-key', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setConfig({ ...config, key_file: response.data.key_path });
      setKeyFile(file);
    } catch (error: unknown) {
      alert(`Error: ${getApiErrorDetail(error, 'Error uploading key')}`);
      setKeyFile(null);
    } finally {
      setUploadingKey(false);
    }
  };

  const handleDrag = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (isPemKeyFile(file.name)) {
      uploadKeyFile(file);
      return;
    }
    alert('Please upload a PEM file');
  };

  const handleKeyFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isPemKeyFile(file.name)) {
      alert('Please upload a PEM file');
      return;
    }
    uploadKeyFile(file);
  };

  const handleFinish = async () => {
    if (!savedDU || !savedOS || !savedGenAI) {
      alert('Please save all configurations first');
      return;
    }

    try {
      await api.post('/setup/complete');
      showToast('Setup completed successfully! You can now log in to the application.');
      onSetupComplete?.();
      navigate('/login');
    } catch (error: unknown) {
      showToast(getApiErrorDetail(error, 'Could not complete setup'));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-semibold mb-2">OCI Services Configuration</h2>

      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-6">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-xs text-blue-800">
            <strong>Configure Oracle Cloud Infrastructure (OCI) for Select AI and Generative AI.</strong>
            <br />
            These values create the OCI credential used by Select AI and Generative AI inside APP_AGENT.
          </div>
        </div>
      </div>

      <ApiKeySection
        config={config}
        setConfig={setConfig}
        dragActive={dragActive}
        uploadingKey={uploadingKey}
        keyFile={keyFile}
        testResult={testResultDU}
        testing={testingDU}
        saving={savingDU}
        saved={savedDU}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onKeyFileChange={handleKeyFileChange}
        onClearKeyFile={() => {
          setKeyFile(null);
          setConfig({ ...config, key_file: '' });
        }}
        onRegionChange={(nextRegion) =>
          setConfig((previous) => ({
            ...previous,
            region: nextRegion,
            inference_url: buildInferenceUrl(nextRegion),
          }))
        }
        onTest={() => runSetupTest({
          endpoint: '/setup/test-oci',
          payload: config,
          setTesting: setTestingDU,
          setResult: setTestResultDU,
          failureMessage: 'OCI connection failed',
        })}
        onSave={() => saveSetupConfig({
          endpoint: '/setup/save-oci-config',
          payload: config,
          canSave: !!testResultDU?.success,
          validationMessage: 'Please test the connection successfully first',
          failureMessage: 'Could not save OCI API key configuration',
          setSaving: setSavingDU,
          setSaved: setSavedDU,
        })}
      />

      <ObjectStorageSection
        config={config}
        setConfig={setConfig}
        savedApiKey={savedDU}
        testResult={testResultOS}
        testing={testingOS}
        saving={savingOS}
        saved={savedOS}
        onTest={() => {
          if (!savedDU) {
            alert('Please save API Key configuration first');
            return;
          }
          runSetupTest({
            endpoint: '/setup/test-object-storage',
            payload: { namespace: config.namespace, bucket_name: config.bucket_name },
            setTesting: setTestingOS,
            setResult: setTestResultOS,
            failureMessage: 'Object Storage validation failed',
          });
        }}
        onSave={() => saveSetupConfig({
          endpoint: '/setup/save-oci-config',
          payload: config,
          canSave: !!testResultOS?.success,
          validationMessage: 'Please test the connection successfully first',
          failureMessage: 'Could not save Object Storage configuration',
          setSaving: setSavingOS,
          setSaved: setSavedOS,
        })}
      />

      <GenerativeAISection
        config={config}
        setConfig={setConfig}
        savedApiKey={savedDU}
        loadingModels={loadingGenAIModels}
        selectedGenerativeInList={selectedGenerativeInList}
        generativeModels={generativeModels}
        testResult={testResultGenAI}
        testing={testingGenAI}
        saving={savingGenAI}
        saved={savedGenAI}
        onTest={() => runSetupTest({
          endpoint: '/setup/test-generative-ai',
          payload: {
            inference_url: config.inference_url,
            generative_model: config.generative_model,
          },
          setTesting: setTestingGenAI,
          setResult: setTestResultGenAI,
          failureMessage: 'Generative AI validation failed',
        })}
        onSave={() => saveSetupConfig({
          endpoint: '/setup/save-generative-ai-config',
          payload: {
            inference_url: config.inference_url,
            generative_model: config.generative_model,
          },
          canSave: !!testResultGenAI?.success,
          validationMessage: 'Please test the connection successfully first',
          failureMessage: 'Could not save Generative AI configuration',
          setSaving: setSavingGenAI,
          setSaved: setSavedGenAI,
        })}
      />

      <FinishSetupButton
        disabled={!savedDU || !savedOS || !savedGenAI}
        onFinish={handleFinish}
      />
    </div>
  );
}
