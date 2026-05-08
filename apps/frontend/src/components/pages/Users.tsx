import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { usersApi, usersQueryKeys, type UserAccount } from '../../services/usersApi';
import { CreateUserModal, DeleteUserModal, UsersTable } from './users/UsersComponents';
import { filterAndSortUsers, getUserApiErrorMessage, paginateItems } from './users/usersUtils';

type UsersAuthUser = { group_id: number } | null;

const PAGE_SIZE = 10;

const emptyUserForm = {
  username: '',
  password: '',
  name: '',
  last_name: '',
  group_id: 1,
};

export function Users({ authUser }: { authUser: UsersAuthUser }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [newUser, setNewUser] = useState(emptyUserForm);

  useEffect(() => {
    if (authUser && authUser.group_id !== 0) {
      navigate('/home');
    }
  }, [authUser, navigate]);

  const { data: usersList = [], isLoading: loading } = useQuery({
    queryKey: usersQueryKeys.list,
    queryFn: () => usersApi.list().then((r) => r.data.users ?? []),
    enabled: !!(authUser && authUser.group_id === 0),
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: usersQueryKeys.groups,
    queryFn: () => usersApi.groups().then((r) => r.data.groups ?? []),
    enabled: !!(authUser && authUser.group_id === 0),
  });

  const filteredUsers = useMemo(() => filterAndSortUsers(usersList, searchTerm), [usersList, searchTerm]);
  const page = useMemo(
    () => paginateItems(filteredUsers, currentPage, PAGE_SIZE),
    [filteredUsers, currentPage]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, usersList]);

  const resetNewUserForm = () => {
    setNewUser({
      ...emptyUserForm,
      group_id: userGroups[0]?.user_group_id ?? emptyUserForm.group_id,
    });
  };

  const handleCreateUser = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await usersApi.create(newUser);
      setSuccessMessage('User created successfully!');
      setShowCreateModal(false);
      resetNewUserForm();
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.list });
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      setErrorMessage(getUserApiErrorMessage(error, 'Failed to create user'));
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget || deletingUser) return;
    setDeletingUser(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      await usersApi.delete(deleteTarget.user_id);
      setSuccessMessage('User deleted successfully!');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: usersQueryKeys.list });
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: unknown) {
      setErrorMessage(getUserApiErrorMessage(error, 'Failed to delete user'));
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Users</h1>
            <p className="text-oracle-light-gray">
              Manage user accounts, access groups, and administrative permissions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-transparent bg-oracle-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-oracle-red/90"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            User
          </button>
        </div>

        <div className="app-light-surface rounded-lg bg-white p-8 shadow">
          {successMessage && (
            <div className="mb-4 flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 flex items-center justify-between rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-4">
            <div className="min-w-[200px] flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="input-oracle focus:border-oracle-red focus:outline-none focus:ring-2 focus:ring-oracle-red/50"
                placeholder="Search by username, name or group..."
                aria-label="Search users"
              />
            </div>
            <button
              type="button"
              onClick={() => queryClient.refetchQueries({ queryKey: usersQueryKeys.list })}
              disabled={loading}
              title="Refresh"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>

          <UsersTable
            currentPage={page.currentPage}
            filteredUsers={filteredUsers}
            loading={loading}
            onClearSearch={() => setSearchTerm('')}
            onDeleteUser={setDeleteTarget}
            onNextPage={() => setCurrentPage((p) => Math.min(page.totalPages, p + 1))}
            onPreviousPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
            pageSize={page.pageSize}
            paginatedUsers={page.items}
            searchTerm={searchTerm}
            startIndex={page.startIndex}
            totalPages={page.totalPages}
            usersList={usersList}
          />
        </div>
      </div>

      {showCreateModal && (
        <CreateUserModal
          newUser={newUser}
          onChange={setNewUser}
          onClose={() => setShowCreateModal(false)}
          onCreate={() => void handleCreateUser()}
          userGroups={userGroups}
        />
      )}

      {deleteTarget ? (
        <DeleteUserModal
          loading={deletingUser}
          user={deleteTarget}
          onConfirm={() => void confirmDeleteUser()}
          onCancel={() => {
            if (!deletingUser) setDeleteTarget(null);
          }}
        />
      ) : null}
    </>
  );
}
