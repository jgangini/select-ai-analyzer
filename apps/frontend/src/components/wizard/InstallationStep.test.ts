import { describe, expect, it } from 'vitest';

import { buildInstallErrorMessage } from './InstallationStep';

describe('InstallationStep helpers', () => {
  it('formats backend detail strings and structured setup errors', () => {
    expect(buildInstallErrorMessage({ response: { data: { detail: 'Wallet password is required' } } })).toBe(
      'Wallet password is required'
    );
    expect(
      buildInstallErrorMessage({
        response: {
          data: {
            detail: {
              errors: [
                { file: '01.sql', error: 'ORA-00955' },
                { file: '02.sql', error: 'ORA-01031' },
              ],
            },
          },
        },
      })
    ).toBe('01.sql: ORA-00955 | 02.sql: ORA-01031');
  });

  it('falls back to error messages and a generic install failure', () => {
    expect(buildInstallErrorMessage({ message: 'Network Error' })).toBe('Network Error');
    expect(buildInstallErrorMessage({})).toBe('Installation failed');
  });
});
