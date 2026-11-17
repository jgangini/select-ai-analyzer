import { describe, expect, it } from 'vitest';

import { getDashboardErrorMessage } from './dashboardsApi';

describe('getDashboardErrorMessage', () => {
  it('prefers API detail, then generic error message, then fallback text', () => {
    expect(getDashboardErrorMessage({ response: { data: { detail: 'Dashboard not found.' } } })).toBe(
      'Dashboard not found.'
    );
    expect(getDashboardErrorMessage(new Error('Network unavailable'))).toBe('Network unavailable');
    expect(getDashboardErrorMessage({})).toBe('Dashboard action failed.');
  });
});
