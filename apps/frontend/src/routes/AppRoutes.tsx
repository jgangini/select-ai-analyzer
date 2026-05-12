import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { LoadingState } from '../components/common/LoadingState';
import { Layout } from '../components/shell/Layout';

const LoginForm = lazy(() => import('../components/auth/LoginForm').then((module) => ({ default: module.LoginForm })));
const Analytics = lazy(() => import('../components/pages/Analytics').then((module) => ({ default: module.Analytics })));
const AnalyticsChatPanel = lazy(() =>
  import('../components/pages/analytics/AnalyticsChatPanel').then((module) => ({ default: module.AnalyticsChatPanel }))
);
const DataSources = lazy(() => import('../components/pages/DataSources').then((module) => ({ default: module.DataSources })));
const Home = lazy(() => import('../components/pages/Home').then((module) => ({ default: module.Home })));
const Profile = lazy(() => import('../components/pages/Profile').then((module) => ({ default: module.Profile })));
const SearchChatsModal = lazy(() =>
  import('../components/pages/analytics/SearchChatsModal').then((module) => ({ default: module.SearchChatsModal }))
);
const Settings = lazy(() => import('../components/pages/Settings').then((module) => ({ default: module.Settings })));
const SetupWizard = lazy(() => import('../components/wizard/SetupWizard').then((module) => ({ default: module.SetupWizard })));
const Users = lazy(() => import('../components/pages/Users').then((module) => ({ default: module.Users })));

function routeFallback() {
  return (
    <div className="app-shell-dark min-h-screen flex items-center justify-center">
      <LoadingState />
    </div>
  );
}

function suspensePage(page: JSX.Element) {
  return <Suspense fallback={routeFallback()}>{page}</Suspense>;
}

function ProtectedRoute({ isAuthenticated, children }: { isAuthenticated: boolean; children: ReactNode }) {
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

type RouteUser = { group_id: number; name?: string; user_id: number; username: string } | null;
type ShowToast = (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
type SidebarChatState = {
  recentConversations: {
    conversation_id: string;
    title: string;
    created_at: string;
    updated_at: string;
  }[];
  recentConversationsLoading: boolean;
  recentConversationsError: boolean;
};
type SetupGateState = {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setupDone: boolean;
  showSpinner: boolean;
  completeSetup: () => void;
  user: RouteUser;
};

function protectedPage(
  isAuthenticated: boolean,
  user: RouteUser,
  onLogout: () => void,
  appName: string,
  sidebarChats: SidebarChatState,
  page: JSX.Element,
  contentContainerClassName?: string
) {
  return (
    <ProtectedRoute isAuthenticated={isAuthenticated}>
      {suspensePage(
        <Layout
          appName={appName}
          contentContainerClassName={contentContainerClassName}
          isAuthenticated={isAuthenticated}
          user={user}
          onLogout={onLogout}
          sidebarChats={sidebarChats}
        >
          {page}
        </Layout>
      )}
    </ProtectedRoute>
  );
}

function setupRoutes(onSetupComplete: () => void) {
  return (
    <Routes>
      <Route path="/setup" element={suspensePage(<SetupWizard onSetupComplete={onSetupComplete} />)} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}

function authenticatedRoutes(
  agentName: string,
  appName: string,
  isAuthenticated: boolean,
  user: RouteUser,
  onLogin: (username: string, password: string) => Promise<void>,
  onLogout: () => void,
  sidebarChats: SidebarChatState,
  showToast: ShowToast
) {
  return (
    <Routes>
      <Route path="/login" element={suspensePage(<LoginForm appName={appName} login={onLogin} />)} />
      <Route
        path="/home"
        element={protectedPage(
          isAuthenticated,
          user,
          onLogout,
          appName,
          sidebarChats,
          <Home appName={appName} currentUserId={user?.user_id ?? 'anonymous'} />
        )}
      />
      <Route
        path="/chat"
        element={protectedPage(
          isAuthenticated,
          user,
          onLogout,
          appName,
          sidebarChats,
          <div className="h-full">
            <AnalyticsChatPanel
              agentName={agentName}
              currentUserId={user?.user_id ?? 'anonymous'}
              showToast={showToast}
              userName={user?.name || 'You'}
            />
          </div>,
          'h-[calc(100vh-90px)] max-w-none px-0 py-0'
        )}
      />
      <Route path="/data-sources" element={protectedPage(isAuthenticated, user, onLogout, appName, sidebarChats, <DataSources showToast={showToast} />)} />
      <Route
        path="/analytics"
        element={protectedPage(
          isAuthenticated,
          user,
          onLogout,
          appName,
          sidebarChats,
          <Analytics currentUserId={Number(user?.user_id || 0)} showToast={showToast} />,
          'h-[calc(100vh-90px)] max-w-none px-0 py-0'
        )}
      />
      <Route path="/dashboards" element={<Navigate to="/analytics" replace />} />
      <Route path="/metadata" element={<Navigate to="/data-sources" replace />} />
      <Route path="/profile" element={protectedPage(isAuthenticated, user, onLogout, appName, sidebarChats, <Profile />, 'max-w-none px-0 py-0')} />
      <Route path="/users" element={protectedPage(isAuthenticated, user, onLogout, appName, sidebarChats, <Users authUser={user} />, 'max-w-none px-0 py-0')} />
      <Route path="/settings" element={protectedPage(isAuthenticated, user, onLogout, appName, sidebarChats, <Settings showToast={showToast} />)} />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/home' : '/login'} replace />} />
    </Routes>
  );
}

export function AppRoutes({
  agentName,
  appName,
  showToast,
  sidebarChats,
  setupGate,
}: {
  agentName: string;
  appName: string;
  showToast: ShowToast;
  sidebarChats: SidebarChatState;
  setupGate: SetupGateState;
}) {
  const { isAuthenticated, login, logout, setupDone, showSpinner, completeSetup, user } = setupGate;

  if (showSpinner) return routeFallback();
  if (!setupDone) return setupRoutes(completeSetup);

  return (
    <>
      {authenticatedRoutes(agentName, appName, isAuthenticated, user, login, logout, sidebarChats, showToast)}
      {suspensePage(
        <SearchChatsModal
          isAuthenticated={isAuthenticated}
          userId={user?.user_id ?? null}
          showToast={showToast}
        />
      )}
    </>
  );
}
