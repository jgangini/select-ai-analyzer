import { describe, expect, it } from 'vitest';

import { getLoginErrorMessage, makeMonochromeOracleSvg } from './LoginForm';

describe('LoginForm helpers', () => {
  it('normalizes OCI SVG assets for monochrome rendering', () => {
    const svg = '<?xml version="1.0"?><svg viewBox="0 0 1 1"><style>.st0{}</style><path class="st1" /><path class="st0" /></svg>';

    expect(makeMonochromeOracleSvg(svg)).toContain('class="h-full w-full"');
    expect(makeMonochromeOracleSvg(svg)).toContain('fill="currentColor"');
    expect(makeMonochromeOracleSvg(svg)).not.toContain('<?xml');
    expect(makeMonochromeOracleSvg(svg)).not.toContain('<style>');
  });

  it('extracts login API details with a safe fallback', () => {
    expect(getLoginErrorMessage({ response: { data: { detail: 'Invalid credentials' } } })).toBe(
      'Invalid credentials'
    );
    expect(getLoginErrorMessage(new Error('Network error'))).toBe(
      'Login failed. Please check your credentials.'
    );
  });
});
