import { describe, expect, it } from 'vitest';

import { validateAdminCredentials } from './SetupWizard';

describe('SetupWizard helpers', () => {
  it('validates initial administrator credentials', () => {
    expect(validateAdminCredentials('', 'password123', 'password123')).toBe('Please enter a valid email');
    expect(validateAdminCredentials('admin@example.com', 'short', 'short')).toBe(
      'Password must be at least 8 characters'
    );
    expect(validateAdminCredentials('admin@example.com', 'password123', 'different')).toBe(
      'Passwords do not match'
    );
    expect(validateAdminCredentials('admin@example.com', 'password123', 'password123')).toBe('');
  });
});
