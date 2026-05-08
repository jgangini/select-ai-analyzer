import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LoadingState } from '../common/LoadingState';
import { ConfirmQuestionModal } from '../common/Modal';
import { settingsApi, settingsQueryKeys } from '../../services/settingsApi';
import { DEFAULT_AGENT_DISPLAY_NAME, DEFAULT_APP_DISPLAY_NAME } from '../../config/branding';

type SettingsPayload = {
  app?: Record<string, unknown>;
  select_ai?: Record<string, unknown>;
  genai?: Record<string, unknown>;
  oci?: Record<string, unknown>;
};

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;

const DEFAULT_AGENT_NAME = DEFAULT_AGENT_DISPLAY_NAME;

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-oracle-light-gray">{children}</p>;
}

export function normalizeSettingsPayload(payload: SettingsPayload): SettingsPayload {
  const app = { ...(payload?.app || {}) };
  const selectAi = { ...(payload?.select_ai || {}) };
  const genai = { ...(payload?.genai || {}) };
  app.name = String(app.name || DEFAULT_APP_DISPLAY_NAME).trim() || DEFAULT_APP_DISPLAY_NAME;
  app.agent_name = String(app.agent_name || DEFAULT_AGENT_NAME).trim() || DEFAULT_AGENT_NAME;
  app.session_timeout_minutes = Number(app.session_timeout_minutes || 480);
  app.timezone = String(app.timezone || 'America/Lima');
  app.language = String(app.language || 'en');
  selectAi.profile_name = String(selectAi.profile_name || 'APP_AGENT_ANALYTICS');
  selectAi.credential_name = String(selectAi.credential_name || 'APP_AGENT_OCI_CRED');
  genai.model = String(genai.model || 'google.gemini-2.5-flash');
  return { ...payload, app, select_ai: selectAi, genai };
}

export function fieldValue(payload: SettingsPayload | null, category: string, field: string, defaultValue = ''): string {
  const value = payload?.[category as keyof SettingsPayload]?.[field];
  return value === undefined || value === null ? defaultValue : String(value);
}

export function Settings({ showToast }: { showToast: ShowToast }) {
  const [formData, setFormData] = useState<SettingsPayload | null>(null);
  const [activeTab, setActiveTab] = useState('app');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.get(),
  });

  useEffect(() => {
    if (data?.data) {
      setFormData(normalizeSettingsPayload(data.data));
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updates: SettingsPayload) => settingsApi.update(updates as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: settingsQueryKeys.publicBranding });
      showToast('Settings saved successfully', 'success');
    },
    onError: (error: unknown) => {
      const maybeError = error as { response?: { data?: { detail?: string } }; message?: string };
      showToast(maybeError.response?.data?.detail || maybeError.message || 'Failed to save settings', 'error');
    },
  });

  const updateField = (category: keyof SettingsPayload, field: string, value: unknown) => {
    setFormData((prev) => ({
      ...(prev || {}),
      [category]: {
        ...((prev?.[category] || {}) as Record<string, unknown>),
        [field]: value,
      },
    }));
  };

  const applicationDisplayName = useMemo(
    () => fieldValue(formData, 'app', 'name', DEFAULT_APP_DISPLAY_NAME),
    [formData]
  );

  if (isLoading || !formData) {
    return <LoadingState className="py-8" label="Loading settings..." textClassName="text-oracle-light-gray" />;
  }

  const tabs = [
    { id: 'app', name: 'Application' },
    { id: 'select_ai', name: 'Select AI' },
    { id: 'oci', name: 'OCI' },
  ];

  const confirmSave = () => {
    updateMutation.mutate(formData);
    setShowSaveModal(false);
  };

  return (
    <>
      <div>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Settings</h1>
            <p className="text-oracle-light-gray">Configure application parameters</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSaveModal(true)} className="btn-primary" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="app-light-surface space-y-6 rounded-lg bg-white p-8 shadow">
          <div className="flex gap-2 border-b border-oracle-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-oracle-red text-oracle-red'
                    : 'border-transparent text-oracle-medium-gray hover:text-oracle-dark-gray'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {activeTab === 'app' && (
            <div className="space-y-4">
              <div className="settings-section-card--neutral flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-100 p-4">
                <svg className="h-10 w-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-800">Application Settings</p>
                  <p className="text-sm text-gray-600">Configure general application behavior</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Application Name</label>
                  <input
                    type="text"
                    value={applicationDisplayName}
                    onChange={(event) => updateField('app', 'name', event.target.value)}
                    className="input-oracle"
                  />
                  <FieldHint>Controls the product name shown in the header, login and home pages.</FieldHint>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Agent Name</label>
                  <input
                    type="text"
                    value={fieldValue(formData, 'app', 'agent_name', DEFAULT_AGENT_NAME)}
                    onChange={(event) => updateField('app', 'agent_name', event.target.value)}
                    className="input-oracle"
                  />
                  <FieldHint>Controls the assistant name used inside chat.</FieldHint>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    min="30"
                    value={fieldValue(formData, 'app', 'session_timeout_minutes', '480')}
                    onChange={(event) => updateField('app', 'session_timeout_minutes', Number(event.target.value || 480))}
                    className="input-oracle"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Timezone</label>
                  <select
                    value={fieldValue(formData, 'app', 'timezone', 'America/Lima')}
                    onChange={(event) => updateField('app', 'timezone', event.target.value)}
                    className="input-oracle"
                  >
                    <option value="America/Lima">America/Lima</option>
                    <option value="America/Bogota">America/Bogota</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Mexico_City">America/Mexico_City</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Default Agent Language</label>
                  <select
                    value={fieldValue(formData, 'app', 'language', 'en')}
                    onChange={(event) => updateField('app', 'language', event.target.value)}
                    className="input-oracle"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="pt">Portuguese</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'select_ai' && (
            <div className="space-y-4">
              <div className="settings-section-card--accent flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <svg className="h-10 w-10 text-oracle-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6m-8 4h10M6 21h12a2 2 0 002-2V7H4v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-800">Select AI Runtime</p>
                  <p className="text-sm text-gray-600">Configure the profile, credential and model used by analytical questions</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Profile Name</label>
                  <input
                    value={fieldValue(formData, 'select_ai', 'profile_name', 'APP_AGENT_ANALYTICS')}
                    onChange={(event) => updateField('select_ai', 'profile_name', event.target.value.toUpperCase())}
                    className="input-oracle font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Credential Name</label>
                  <input
                    value={fieldValue(formData, 'select_ai', 'credential_name', 'APP_AGENT_OCI_CRED')}
                    onChange={(event) => updateField('select_ai', 'credential_name', event.target.value.toUpperCase())}
                    className="input-oracle font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">Generative Model</label>
                  <input
                    value={fieldValue(formData, 'genai', 'model', 'google.gemini-2.5-flash')}
                    onChange={(event) => updateField('genai', 'model', event.target.value)}
                    className="input-oracle"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'oci' && (
            <div className="space-y-4">
              <div className="settings-section-card--neutral flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-100 p-4">
                <svg className="h-10 w-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 014-4h.26A8 8 0 1120 17H7a4 4 0 01-4-4z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-800">Saved OCI Configuration</p>
                  <p className="text-sm text-gray-600">Values captured by the setup wizard</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Region', fieldValue(formData, 'oci', 'region', '-')],
                  ['Compartment', fieldValue(formData, 'oci', 'compartment_id', '-')],
                  ['Namespace', fieldValue(formData, 'oci', 'namespace', '-')],
                  ['Bucket', fieldValue(formData, 'oci', 'bucket_name', '-')],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
                    <p className="mt-2 truncate text-sm font-medium text-gray-900" title={value}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showSaveModal && (
        <ConfirmQuestionModal
          title="Save settings"
          message="Are you sure you want to save these changes?"
          detail="Applies modified settings immediately for all users."
          confirmText="Save changes"
          confirmClass="text-red-600 hover:bg-red-50"
          onConfirm={confirmSave}
          onCancel={() => setShowSaveModal(false)}
          loading={updateMutation.isPending}
          loadingText="Saving..."
        />
      )}
    </>
  );
}
