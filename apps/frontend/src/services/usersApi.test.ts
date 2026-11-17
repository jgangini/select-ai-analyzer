import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock('./httpClient', () => ({ default: apiMock }));

import { LOGIN_REQUEST_TIMEOUT_MS, usersApi } from './usersApi';

describe('usersApi', () => {
  beforeEach(() => {
    apiMock.delete.mockReset();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
  });

  it('posts credentials to the auth login endpoint', () => {
    usersApi.login('nadia', 'secret');

    expect(apiMock.post).toHaveBeenCalledWith(
      '/auth/login',
      {
        username: 'nadia',
        password: 'secret',
      },
      { timeout: LOGIN_REQUEST_TIMEOUT_MS }
    );
  });

  it('uses the authenticated user and user-management endpoints', () => {
    usersApi.currentUser();
    usersApi.list();
    usersApi.groups();
    usersApi.create({ username: 'ana', password: 'pw', name: 'Ana', last_name: 'Diaz', group_id: 1 });
    usersApi.delete(42);

    expect(apiMock.get).toHaveBeenCalledWith('/user/me', { timeout: 10000 });
    expect(apiMock.get).toHaveBeenCalledWith('/user/users');
    expect(apiMock.get).toHaveBeenCalledWith('/user/groups');
    expect(apiMock.post).toHaveBeenCalledWith('/user/create', {
      username: 'ana',
      password: 'pw',
      name: 'Ana',
      last_name: 'Diaz',
      group_id: 1,
    });
    expect(apiMock.delete).toHaveBeenCalledWith('/user/42');
  });

  it('uses profile endpoints for account updates', () => {
    usersApi.updateProfile({ name: 'Ana', last_name: 'Diaz' });
    usersApi.changePassword({ current_password: 'old', new_password: 'new' });

    expect(apiMock.put).toHaveBeenCalledWith('/user/profile', {
      name: 'Ana',
      last_name: 'Diaz',
    });
    expect(apiMock.post).toHaveBeenCalledWith('/user/change-password', {
      current_password: 'old',
      new_password: 'new',
    });
  });
});
