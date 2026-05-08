import { describe, expect, it } from 'vitest';

import { filterAndSortUsers, formatUserTimestamp, getUserApiErrorMessage, paginateItems } from './usersUtils';

describe('users utilities', () => {
  it('filters users by username, name, last name, or group and sorts newest first', () => {
    const users = [
      {
        username: 'analyst@example.com',
        name: 'Ana',
        last_name: 'Lopez',
        group_name: 'Analysts',
        created: '2026-01-01T10:00:00Z',
      },
      {
        username: 'admin@example.com',
        name: 'Root',
        last_name: 'Admin',
        group_name: 'Administrators',
        user_created: '2026-03-01T10:00:00Z',
      },
      {
        username: 'viewer@example.com',
        name: 'Victor',
        last_name: 'Reader',
        group_name: 'Viewers',
        created: '2026-02-01T10:00:00Z',
      },
    ];

    expect(filterAndSortUsers(users, 'ad').map((user) => user.username)).toEqual([
      'admin@example.com',
      'viewer@example.com',
    ]);
  });

  it('returns all users sorted newest first when search is blank', () => {
    const users = [
      { username: 'old', created: '2026-01-01T00:00:00Z' },
      { username: 'new', created: '2026-01-02T00:00:00Z' },
    ];

    expect(filterAndSortUsers(users, '  ').map((user) => user.username)).toEqual(['new', 'old']);
  });

  it('formats user timestamps and handles empty values', () => {
    expect(formatUserTimestamp(null)).toBe('\u2014');
    expect(formatUserTimestamp('not-a-date')).toBe('\u2014');
    expect(formatUserTimestamp('2026-01-02T03:04:05.006Z')).toMatch(
      /^\d{2}-\d{2}-2026 \d{2}:04:05\.006$/
    );
  });

  it('paginates items with a clamped page number and stable bounds', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];

    expect(paginateItems(items, 2, 2)).toEqual({
      items: ['c', 'd'],
      currentPage: 2,
      pageSize: 2,
      startIndex: 2,
      totalPages: 3,
    });
    expect(paginateItems(items, 99, 2).items).toEqual(['e']);
    expect(paginateItems(items, 0, 0)).toMatchObject({
      currentPage: 1,
      pageSize: 1,
      totalPages: 5,
    });
  });

  it('extracts user API error details with a fallback', () => {
    expect(getUserApiErrorMessage({ response: { data: { detail: 'Cannot delete admin' } } }, 'Failed')).toBe(
      'Cannot delete admin'
    );
    expect(getUserApiErrorMessage(new Error('Network error'), 'Failed')).toBe('Failed');
  });
});
