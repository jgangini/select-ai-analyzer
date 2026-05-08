export type UserSearchRecord = {
  username?: string | null;
  name?: string | null;
  last_name?: string | null;
  group_name?: string | null;
  created?: string | null;
  user_created?: string | null;
};

export type UserAccountRecord = UserSearchRecord & {
  user_id: number;
  username: string;
  name: string;
  last_name: string;
  group_id: number;
  group_name: string;
};

export type UserGroupOption = {
  user_group_id: number;
  user_group_name: string;
};

export type CreateUserForm = {
  username: string;
  password: string;
  name: string;
  last_name: string;
  group_id: number;
};

function searchableUserText(user: UserSearchRecord): string {
  return [user.username, user.name, user.last_name, user.group_name]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
}

function userCreatedTime(user: UserSearchRecord): number {
  const created = user.created ?? user.user_created;
  return created ? new Date(created).getTime() || 0 : 0;
}

export function filterAndSortUsers<T extends UserSearchRecord>(users: T[], searchTerm: string): T[] {
  const term = searchTerm.trim().toLowerCase();
  const filtered = term ? users.filter((user) => searchableUserText(user).includes(term)) : users;
  return [...filtered].sort((left, right) => userCreatedTime(right) - userCreatedTime(left));
}

export function paginateItems<T>(items: T[], currentPage: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const safeCurrentPage = Math.min(totalPages, Math.max(1, Math.floor(currentPage) || 1));
  const startIndex = (safeCurrentPage - 1) * safePageSize;

  return {
    items: items.slice(startIndex, startIndex + safePageSize),
    currentPage: safeCurrentPage,
    pageSize: safePageSize,
    startIndex,
    totalPages,
  };
}

export function formatUserTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '\u2014';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export function getUserApiErrorMessage(error: unknown, fallback: string): string {
  const maybeError = error as { response?: { data?: { detail?: string } } };
  return maybeError.response?.data?.detail || fallback;
}
