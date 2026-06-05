import type { ChangeEventHandler, DragEventHandler } from 'react';

type ConnectionAliasFieldProps = {
  dsn: string;
  dsnOptions: string[];
  defaultDsn: string;
  onDsnChange: (dsn: string) => void;
};

type WalletUploadFieldProps = {
  walletFile: File | null;
  walletPath: string;
  uploadError: string;
  dragActive: boolean;
  uploading: boolean;
  onDrag: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onClearFile: () => void;
};

type WizardPasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onToggleVisible: () => void;
  inputClassName?: string;
  placeholder?: string;
};

const FIELD_LABEL_CLASS = 'block text-sm font-medium mb-1';
const HELPER_TEXT_CLASS = 'text-xs text-gray-500 mt-1';
const PASSWORD_ICON_CLASS = 'w-5 h-5';

export function DatabaseSetupNotice() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-6">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
        </svg>
        <div className="text-xs text-blue-800">
          <strong>Configure the Oracle 26ai database connection for APP_AGENT.</strong>
          <br />
          The connected database user must be APP_AGENT or a numbered deployment schema such as APP_AGENT_1.
          <br />
          Later these can be changed to install to a production ready database.
        </div>
      </div>
    </div>
  );
}

export function WalletUploadField({
  walletFile,
  walletPath,
  uploadError,
  dragActive,
  uploading,
  onDrag,
  onDrop,
  onFileChange,
  onClearFile,
}: WalletUploadFieldProps) {
  return (
    <div className="mb-6">
      <label className={FIELD_LABEL_CLASS}>Wallet ZIP</label>
      <div
        className={`py-4 px-6 border-2 border-dashed rounded-lg text-center transition-all cursor-pointer ${
          dragActive
            ? 'border-oracle-red bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={onDrop}
      >
        {uploading ? (
          <div className="text-gray-600">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-oracle-red mx-auto mb-2"></div>
            <div>Uploading wallet...</div>
          </div>
        ) : (
          <>
            <div className="text-gray-600 mb-1">
              <strong>Drag and Drop</strong>
            </div>
            <div className="text-sm text-gray-500 mb-1">Select a file or drop one here</div>
            <input
              id="wallet-upload"
              type="file"
              accept=".zip"
              onChange={onFileChange}
              className="hidden"
            />
            <label
              htmlFor="wallet-upload"
              className="text-oracle-blue-link hover:underline text-sm cursor-pointer"
            >
              Select file
            </label>
          </>
        )}
      </div>

      {walletFile && (
        <div className="mt-2 flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
          <span className="text-sm text-gray-600">Selected File: {walletFile.name}</span>
          <button
            type="button"
            onClick={onClearFile}
            className="text-red-600 hover:text-red-800 text-xl leading-none"
            aria-label="Remove selected wallet file"
          >
            x
          </button>
        </div>
      )}

      {walletPath && (
        <p className="mt-2 text-sm text-green-600">Wallet uploaded successfully</p>
      )}

      {uploadError && (
        <p className="mt-2 text-sm text-red-600">{uploadError}</p>
      )}
    </div>
  );
}

export function ConnectionAliasField({
  dsn,
  dsnOptions,
  defaultDsn,
  onDsnChange,
}: ConnectionAliasFieldProps) {
  return (
    <div>
      <label className={FIELD_LABEL_CLASS}>Connection (TNS alias) *</label>
      {dsnOptions.length ? (
        <select
          value={dsn}
          onChange={(event) => onDsnChange(event.target.value)}
          className="input-oracle w-full"
        >
          {dsnOptions.map((alias) => (
            <option key={alias} value={alias}>
              {alias}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={dsn}
          onChange={(event) => onDsnChange(event.target.value)}
          className="input-oracle w-full"
          placeholder={defaultDsn}
        />
      )}
      <p className={HELPER_TEXT_CLASS}>
        Alias loaded from <code>tnsnames.ora</code>.
      </p>
    </div>
  );
}

function HiddenIcon() {
  return (
    <svg className={PASSWORD_ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

function VisibleIcon() {
  return (
    <svg className={PASSWORD_ICON_CLASS} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export function WizardPasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggleVisible,
  inputClassName = 'input-oracle w-full pr-10',
  placeholder,
}: WizardPasswordFieldProps) {
  const visibilityLabel = visible ? 'Hide password' : 'Show password';

  return (
    <div>
      <label className={FIELD_LABEL_CLASS} htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className={inputClassName}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          title={visibilityLabel}
          aria-label={visibilityLabel}
        >
          {visible ? <HiddenIcon /> : <VisibleIcon />}
        </button>
      </div>
    </div>
  );
}
