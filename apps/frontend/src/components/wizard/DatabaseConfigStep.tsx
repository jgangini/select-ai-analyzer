import { useState } from 'react';
import api from '../../services/httpClient';
import {
  ConnectionAliasField,
  DatabaseSetupNotice,
  WalletUploadField,
  WizardPasswordField,
} from './DatabaseConfigFields';
import { DEFAULT_DSN, buildUploadErrorMessage, getApiErrorDetail, isWalletZipFile, pickPreferredDsn } from './selectAISetupUtils';

interface Props {
  onNext: (data: DatabaseConfigStepData) => void;
}

type DatabaseConfigStepData = {
  database: {
    walletPath: string;
    walletPassword: string;
    username: string;
    password: string;
    dsn: string;
  };
};

type DatabaseConnectionResult = {
  success: boolean;
  message: string;
};

export function DatabaseConfigStep({ onNext }: Props) {
  const [walletFile, setWalletFile] = useState<File | null>(null);
  const [walletPassword, setWalletPassword] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dsn, setDsn] = useState(DEFAULT_DSN);
  const [dsnOptions, setDsnOptions] = useState<string[]>([]);
  const [walletPath, setWalletPath] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DatabaseConnectionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showWalletPassword, setShowWalletPassword] = useState(false);

  const loadWalletDsns = async (uploadedWalletPath: string) => {
    try {
      const response = await api.post('/setup/list-wallet-dsns', {
        wallet_path: uploadedWalletPath,
      });
      const aliases = Array.isArray(response.data?.dsns) ? response.data.dsns : [];
      if (!aliases.length) {
        setDsnOptions([]);
        setUploadError('Wallet uploaded, but no TNS aliases were found in tnsnames.ora');
        return;
      }
      setDsnOptions(aliases);
      setDsn(pickPreferredDsn(aliases, response.data?.selected_dsn));
    } catch (error: unknown) {
      setDsnOptions([]);
      const detail = getApiErrorDetail(error, 'Could not read tnsnames.ora aliases');
      setUploadError(`Wallet uploaded, but aliases could not be loaded: ${detail}`);
    }
  };

  const uploadWallet = async (file: File) => {
    setUploadError('');
    setWalletPath('');
    setWalletFile(null);
    setDsnOptions([]);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/setup/upload-wallet', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      const uploadedWalletPath = response.data.wallet_path;
      setWalletPath(uploadedWalletPath);
      setWalletFile(file);
      const aliases = Array.isArray(response.data?.dsns) ? response.data.dsns : [];
      if (aliases.length) {
        setDsnOptions(aliases);
        setDsn(pickPreferredDsn(aliases, response.data?.selected_dsn));
      } else {
        await loadWalletDsns(uploadedWalletPath);
      }
    } catch (error: unknown) {
      const errorMessage = buildUploadErrorMessage(error);
      setUploadError(errorMessage);
      alert(`Error: ${errorMessage}`);
      setWalletPath('');
      setWalletFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleWalletFile = (file: File) => {
    if (!isWalletZipFile(file.name)) {
      setUploadError('Please upload a ZIP file (.zip)');
      alert('Please upload a ZIP file');
      return;
    }
    uploadWallet(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleWalletFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleWalletFile(e.target.files[0]);
    }
    // Allow selecting the same file again after a failed upload.
    e.target.value = '';
  };

  const handleTestConnection = async () => {
    if (!walletPath) {
      alert('Please upload the wallet file first');
      return;
    }
    if (!walletPassword.trim()) {
      alert('Wallet password is required');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const payload = {
        wallet_path: walletPath,
        wallet_password: walletPassword,
        user: username,
        password: password,
        dsn: dsn,
      };

      const response = await api.post('/setup/test-db', payload);
      await api.post('/setup/save-db-runtime', payload);

      setTestResult({
        success: true,
        ...response.data,
        message: 'Database connection successful and saved for runtime',
      });
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: getApiErrorDetail(error, 'Connection error'),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleNext = () => {
    if (!testResult?.success) {
      alert('Please test the connection successfully first');
      return;
    }
    onNext({
      database: {
        walletPath,
        walletPassword,
        username,
        password,
        dsn,
      },
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Database Configuration</h2>

      <DatabaseSetupNotice />

      <WalletUploadField
        walletFile={walletFile}
        walletPath={walletPath}
        uploadError={uploadError}
        dragActive={dragActive}
        uploading={uploading}
        onDrag={handleDrag}
        onDrop={handleDrop}
        onFileChange={handleFileChange}
        onClearFile={() => {
          setWalletFile(null);
          setWalletPath('');
        }}
      />

      {/* Connection Alias + Wallet Password */}
      {walletPath && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <ConnectionAliasField
            dsn={dsn}
            dsnOptions={dsnOptions}
            defaultDsn={DEFAULT_DSN}
            onDsnChange={setDsn}
          />

          <div>
            <WizardPasswordField
              id="wallet-password"
              label="Wallet Password *"
              value={walletPassword}
              visible={showWalletPassword}
              onChange={(e) => setWalletPassword(e.target.value)}
              onToggleVisible={() => setShowWalletPassword((prev) => !prev)}
              placeholder="Wallet password"
            />
            <p className="text-xs text-gray-500 mt-1">
              Required for OCI wallet downloaded from the console.
            </p>
          </div>
        </div>
      )}

      {/* Connection Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Username *</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-oracle"
            placeholder="APP_AGENT"
          />
        </div>

        <WizardPasswordField
          id="database-password"
          label="Password *"
          value={password}
          visible={showPassword}
          onChange={(e) => setPassword(e.target.value)}
          onToggleVisible={() => setShowPassword((prev) => !prev)}
          inputClassName="input-oracle pr-10"
        />
      </div>

      {testResult && (
        <div
          className={`p-3 rounded mb-6 text-sm ${
            testResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {testResult.message}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={handleTestConnection}
          disabled={testing || !walletPath || !walletPassword.trim() || !username || !password || !dsn}
          className="btn-secondary flex items-center gap-2"
        >
          {testing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {testing ? 'Testing...' : 'Test connection'}
        </button>
        <button
          onClick={handleNext}
          disabled={!testResult?.success}
          className="btn-primary flex items-center gap-2"
        >
          <span>Next</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
