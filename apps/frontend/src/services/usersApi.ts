import api from './httpClient';

export type UserAccount = {
  user_id: number;
  username: string;
  name: string;
  last_name: string;
  email?: string;
  modules?: number[];
  group_id: number;
  group_name: string;
  created?: string | null;
  user_created?: string | null;
};

export type UserGroup = {
  user_group_id: number;
  user_group_name: string;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  name: string;
  last_name: string;
  group_id: number;
};

export type UpdateProfilePayload = {
  name: string;
  last_name: string;
};

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export type LoginResponse = {
  access_token: string;
  user: UserAccount;
};

export const usersQueryKeys = {
  me: ['users', 'me'] as const,
  list: ['users', 'list'] as const,
  groups: ['users', 'groups'] as const,
};

export const usersApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),
  currentUser: () => api.get<UserAccount>('/user/me', { timeout: 10000 }),
  list: () => api.get<{ users?: UserAccount[] }>('/user/users'),
  groups: () => api.get<{ groups?: UserGroup[] }>('/user/groups'),
  create: (payload: CreateUserPayload) => api.post('/user/create', payload),
  delete: (userId: number) => api.delete(`/user/${userId}`),
  updateProfile: (payload: UpdateProfilePayload) => api.put('/user/profile', payload),
  changePassword: (payload: ChangePasswordPayload) => api.post('/user/change-password', payload),
};
