import { Fragment, useState } from 'react';
import { DatabaseConfigStep } from './DatabaseConfigStep';
import { InstallationStep } from './InstallationStep';
import { SelectAIServicesStep } from './SelectAIServicesStep';
import { Footer } from '../shell/Footer';
import { DEFAULT_APP_DISPLAY_NAME } from '../../config/branding';

const STEPS = [
  { id: 1, name: 'User configuration' },
  { id: 2, name: 'Database configuration' },
  { id: 3, name: 'Installation' },
  { id: 4, name: 'OCI services' },
];

interface SetupWizardProps {
  onSetupComplete?: () => void;
}

type SetupWizardData = {
  adminEmail?: string;
  adminPassword?: string;
  database?: {
    walletPath?: string;
    walletPassword?: string;
    username?: string;
    password?: string;
    dsn?: string;
  };
  installation?: unknown;
};

interface UserConfigStepProps {
  onNext: (data: Pick<SetupWizardData, 'adminEmail' | 'adminPassword'>) => void;
}

export function validateAdminCredentials(email: string, password: string, confirmPassword: string): string {
  if (!email || !email.includes('@')) {
    return 'Please enter a valid email';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return '';
}

function UserConfigStep({ onNext }: UserConfigStepProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleNext = () => {
    const validationError = validateAdminCredentials(email, password, confirmPassword);
    setError(validationError);
    if (validationError) {
      return;
    }

    onNext({
      adminEmail: email,
      adminPassword: password,
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-250px)] items-center justify-center">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <h2 className="mb-2 text-center text-2xl font-semibold">Sign Up</h2>
        <p className="mb-6 text-center text-gray-600">Sign Up to continue</p>

        <div className="mb-6 rounded border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-xs text-blue-800">
              <strong>Info</strong>
              <br />
              This user would be responsible for managing the {DEFAULT_APP_DISPLAY_NAME} application and its other users.
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="input-oracle"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password *</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input-oracle"
              placeholder="Enter your password"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Repeat Password *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="input-oracle"
              placeholder="Type your password again"
            />
          </div>
        </div>

        {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        <div className="flex justify-end">
          <button
            onClick={handleNext}
            disabled={!email || !password || !confirmPassword}
            className="btn-primary flex items-center gap-2"
          >
            <span>Next</span>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function SetupWizard({ onSetupComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupWizardData>({});
  const currentStepInfo = STEPS.find((step) => step.id === currentStep) ?? STEPS[0];
  const progressPercent = ((currentStep - 1) / Math.max(STEPS.length - 1, 1)) * 100;

  const handleNext = (stepData: Partial<SetupWizardData>) => {
    setSetupData({ ...setupData, ...stepData });
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const renderStep = () => {
    const props = {
      data: setupData,
      onNext: handleNext,
      onSetupComplete: onSetupComplete,
    };

    switch (currentStep) {
      case 1:
        return <UserConfigStep {...props} />;
      case 2:
        return <DatabaseConfigStep {...props} />;
      case 3:
        return <InstallationStep {...props} />;
      case 4:
        return <SelectAIServicesStep {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="setup-shell-ambient flex min-h-screen flex-col pb-12 text-oracle-dark-gray">
      {/* Stepper */}
      <div className="setup-stepper-surface app-content-layer">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div className="hidden items-start justify-between md:flex">
            {STEPS.map((step, index) => (
              <Fragment key={step.id}>
                <div className="flex w-32 flex-col items-center">
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                      step.id === currentStep
                        ? 'bg-oracle-red text-white'
                        : step.id < currentStep
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/10 text-white/48'
                    }`}
                  >
                    {step.id < currentStep ? (
                      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <path
                          d="M5 12.5l4.3 4.2L19 7"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.4"
                        />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="mt-2 text-center text-sm leading-5 text-white/68">{step.name}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="flex min-w-10 flex-1 items-center px-2 pt-5">
                    <div className={`h-1 w-full rounded-full ${step.id < currentStep ? 'bg-emerald-600' : 'bg-white/10'}`} />
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          <div className="md:hidden">
            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-oracle-red transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{currentStepInfo.name}</p>
                <p className="text-xs text-white/50">Complete this step to continue.</p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oracle-red text-sm font-semibold text-white">
                {currentStep}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="app-content-layer mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-20 sm:px-6 sm:py-8 lg:px-8">
        {renderStep()}
      </div>

      <Footer />
    </div>
  );
}
