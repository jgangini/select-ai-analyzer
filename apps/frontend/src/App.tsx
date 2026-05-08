import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, ToastViewport, useToast } from './context/ToastContext';
import { AnalyticsChatProvider } from './context/AnalyticsChatContext';
import { analyticsApi, analyticsQueryKeys, sortConversations } from './services/analyticsApi';
import {
  checkSetupComplete,
  resolveAgentName,
  resolveApplicationName,
  settingsQueryKeys,
  setupQueryKeys,
} from './services/settingsApi';
import { usersApi, usersQueryKeys } from './services/usersApi';
import './styles/oracle.css';

type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
type AppRoutesComponent = (props: {
  agentName: string;
  appName: string;
  showToast: ShowToast;
  sidebarChats: ReturnType<typeof useSidebarChats>;
  setupGate: ReturnType<typeof useSetupGate>;
}) => JSX.Element;

async function fetchPublicBranding(): Promise<unknown> {
  const response = await fetch('/api/settings/public');
  if (!response.ok) {
    throw new Error('Could not load public branding.');
  }
  return response.json();
}

function useSidebarChats(isAuthenticated: boolean, userId: number | string | null) {
  const query = useQuery({
    queryKey: analyticsQueryKeys.sidebarConversations(userId ?? 'anonymous'),
    queryFn: async () => {
      const response = await analyticsApi.listConversations(undefined, 20);
      return sortConversations(response.data.items || []);
    },
    enabled: isAuthenticated,
  });

  return {
    recentConversations: query.data || [],
    recentConversationsLoading: query.isLoading,
    recentConversationsError: query.isError,
  };
}

function useSetupGate() {
  const queryClient = useQueryClient();
  const { isAuthenticated, loading, login, logout, token, user } = useAuth();
  const { data: setupCompleted, isPending: setupPending } = useQuery({
    queryKey: setupQueryKeys.check,
    queryFn: checkSetupComplete,
    staleTime: Infinity,
    retry: false,
  });

  const setupDone = setupCompleted === true;
  const showSpinner = loading || setupPending;

  useEffect(() => {
    if (!setupPending && !setupDone && setupCompleted === false) logout();
  }, [setupPending, setupDone, setupCompleted, logout]);

  const completeSetup = () => queryClient.setQueryData(setupQueryKeys.check, true);

  return { isAuthenticated, login, logout, setupDone, showSpinner, completeSetup, user, token };
}

function useAppBranding() {
  const query = useQuery({
    queryKey: settingsQueryKeys.publicBranding,
    queryFn: fetchPublicBranding,
    staleTime: 60_000,
    retry: false,
  });

  return {
    ...query,
    appName: resolveApplicationName(query.data),
    agentName: resolveAgentName(query.data),
  };
}

function SessionScopedApp({ RoutesComponent }: { RoutesComponent: AppRoutesComponent }) {
  const setupGate = useSetupGate();
  const { isAuthenticated, user, token } = setupGate;
  const { showToast } = useToast();
  const { agentName, appName } = useAppBranding();
  const sessionScope = user?.user_id ?? token ?? 'anonymous';
  const sidebarChats = useSidebarChats(isAuthenticated, user?.user_id ?? null);

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  return (
    <AnalyticsChatProvider key={String(sessionScope)}>
      <RoutesComponent
        agentName={agentName}
        appName={appName}
        showToast={showToast}
        sidebarChats={sidebarChats}
        setupGate={setupGate}
      />
    </AnalyticsChatProvider>
  );
}

function App({ RoutesComponent }: { RoutesComponent: AppRoutesComponent }) {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider authClient={usersApi} userQueryKeys={usersQueryKeys}>
        <ToastProvider>
          <SessionScopedApp RoutesComponent={RoutesComponent} />
          <ToastViewport />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
