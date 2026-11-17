import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

type AuthUser = {
  group_id: number;
  user_id: number;
  username: string;
  name?: string;
  last_name?: string;
  group_name?: string;
};

type AuthClient = {
  currentUser: () => Promise<{ data: AuthUser }>;
  login: (username: string, password: string) => Promise<{ data: { access_token: string; user: AuthUser } }>;
};

type AuthQueryKeys = {
  me: readonly unknown[];
};

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function clearSessionCaches(queryClient: QueryClient) {
  queryClient.removeQueries({ queryKey: ['analytics'] });
  queryClient.removeQueries({ queryKey: ['data-sources'] });
}

export function AuthProvider({
  authClient,
  children,
  userQueryKeys,
}: {
  authClient: AuthClient;
  children: ReactNode;
  userQueryKeys: AuthQueryKeys;
}) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  const { data: user, isPending: userLoading, isError } = useQuery({
    queryKey: [...userQueryKeys.me, token],
    queryFn: () => authClient.currentUser().then((res) => res.data),
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!!token && !userLoading && isError) {
      setToken(null);
      localStorage.removeItem('token');
      clearSessionCaches(queryClient);
      queryClient.removeQueries({ queryKey: userQueryKeys.me });
    }
  }, [queryClient, token, userLoading, isError, userQueryKeys.me]);

  const login = async (username: string, password: string) => {
    const response = await authClient.login(username, password);
    const { access_token, user: userData } = response.data;
    clearSessionCaches(queryClient);
    queryClient.removeQueries({ queryKey: userQueryKeys.me });
    setToken(access_token);
    localStorage.setItem('token', access_token);
    queryClient.setQueryData([...userQueryKeys.me, access_token], userData);
  };

  const logout = () => {
    clearSessionCaches(queryClient);
    setToken(null);
    localStorage.removeItem('token');
    queryClient.removeQueries({ queryKey: userQueryKeys.me });
  };

  const loading = !!token && userLoading;
  const isAuthenticated = !!token && !!user;
  const isAdmin = !!user && user.group_id === 0;

  return (
    <AuthContext.Provider
      value={{ user: user ?? null, token, login, logout, isAuthenticated, isAdmin, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
