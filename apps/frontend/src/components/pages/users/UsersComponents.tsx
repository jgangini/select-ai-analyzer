import { LoadingState } from '../shared/LoadingState';
import { ConfirmDeleteModal } from '../shared/Modal';
import { formatUserTimestamp, type CreateUserForm, type UserAccountRecord, type UserGroupOption } from './usersUtils';

function highlightMatch(text: string, search: string) {
  if (!search.trim() || !text) return text || '\u2014';
  const term = search.trim().toLowerCase();
  const lower = text.toLowerCase();
  const index = lower.indexOf(term);
  if (index === -1) return text || '\u2014';

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-200 px-0.5">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

export function UsersTable({
  currentPage,
  filteredUsers,
  loading,
  onClearSearch,
  onDeleteUser,
  onNextPage,
  onPreviousPage,
  pageSize,
  paginatedUsers,
  searchTerm,
  startIndex,
  totalPages,
  usersList,
}: {
  currentPage: number;
  filteredUsers: UserAccountRecord[];
  loading: boolean;
  onClearSearch: () => void;
  onDeleteUser: (user: UserAccountRecord) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  pageSize: number;
  paginatedUsers: UserAccountRecord[];
  searchTerm: string;
  startIndex: number;
  totalPages: number;
  usersList: UserAccountRecord[];
}) {
  if (loading) {
    return <LoadingState className="py-12" />;
  }

  if (usersList.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <svg className="mx-auto mb-4 h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <p className="mb-2 text-gray-500">No users yet</p>
        <p className="text-sm text-gray-400">Create a user with + User</p>
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
        <p className="text-gray-500">No users match your search</p>
        <button
          type="button"
          onClick={onClearSearch}
          className="mt-2 text-sm text-oracle-blue-link hover:underline"
        >
          Clear search
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-16 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Username
              </th>
              <th className="max-w-[180px] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Group
              </th>
              <th className="w-[190px] min-w-[190px] max-w-[190px] px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
              <th className="w-24 min-w-0 px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {paginatedUsers.map((user, index) => {
              const displayName = [user.name, user.last_name].filter(Boolean).join(' ');

              return (
                <tr key={user.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-center text-sm font-semibold text-gray-700">
                    {startIndex + index + 1}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {highlightMatch(user.username || '', searchTerm)}
                  </td>
                  <td className="max-w-[180px] truncate px-6 py-4 text-sm text-gray-600" title={displayName || undefined}>
                    {highlightMatch(displayName, searchTerm)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {highlightMatch(user.group_name || '', searchTerm)}
                  </td>
                  <td className="w-[190px] min-w-[190px] max-w-[190px] whitespace-nowrap px-3 py-1.5">
                    {formatUserTimestamp(user.created ?? user.user_created)}
                  </td>
                  <td className="w-24 min-w-0 whitespace-nowrap px-3 py-1.5 text-center text-sm">
                    {user.user_id !== 0 && (
                      <button
                        type="button"
                        onClick={() => onDeleteUser(user)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 transition-colors hover:bg-gray-100"
                        title="Delete user"
                        aria-label={`Delete ${user.username || 'user'}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0l1 12h6l1-12M10 11v6m4-6v6"
                          />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <p className="text-sm text-gray-600">
          Showing {startIndex + 1}-{Math.min(startIndex + pageSize, filteredUsers.length)} of {filteredUsers.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}

export function CreateUserModal({
  newUser,
  onChange,
  onClose,
  onCreate,
  userGroups,
}: {
  newUser: CreateUserForm;
  onChange: (user: CreateUserForm) => void;
  onClose: () => void;
  onCreate: () => void;
  userGroups: UserGroupOption[];
}) {
  return (
    <div className="fixed inset-0 z-[300] m-0 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border-0 shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <div className="flex items-center gap-3 bg-oracle-dark-gray px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Create New User</h2>
          <div className="ml-auto" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-200 transition-colors hover:bg-white/10"
            aria-label="Close create user modal"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 bg-white p-8">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email *</label>
              <input
                type="email"
                value={newUser.username}
                onChange={(event) => onChange({ ...newUser, username: event.target.value })}
                className="input-oracle"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Password *</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(event) => onChange({ ...newUser, password: event.target.value })}
                className="input-oracle"
                placeholder="Password"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">First Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(event) => onChange({ ...newUser, name: event.target.value })}
                  className="input-oracle"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Last Name *</label>
                <input
                  type="text"
                  value={newUser.last_name}
                  onChange={(event) => onChange({ ...newUser, last_name: event.target.value })}
                  className="input-oracle"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">User Group</label>
              <select
                value={newUser.group_id}
                onChange={(event) => onChange({ ...newUser, group_id: parseInt(event.target.value, 10) })}
                className="input-oracle"
              >
                {userGroups.map((group) => (
                  <option key={group.user_group_id} value={group.user_group_id}>
                    {group.user_group_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCreate}
              disabled={!newUser.username || !newUser.password || !newUser.name}
              className="btn-primary flex-1"
            >
              Create
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeleteUserModal({
  loading,
  onCancel,
  onConfirm,
  user,
}: {
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  user: UserAccountRecord;
}) {
  return (
    <ConfirmDeleteModal
      title="Delete user"
      message={
        <span>
          Are you sure you want to delete{' '}
          <span className="font-medium text-oracle-dark-gray">
            {user.username || 'this user'}
          </span>
          ?
        </span>
      }
      detail="This removes the user account from the application."
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
