import { describe, it, expect } from 'vitest';
import { safeAuthRedirectPath } from './safe-redirect';

describe('safeAuthRedirectPath', () => {
  it('allows safe in-app paths', () => {
    expect(safeAuthRedirectPath('/dashboard')).toBe('/dashboard');
    expect(safeAuthRedirectPath('/clients/ajouter')).toBe('/clients/ajouter');
    expect(safeAuthRedirectPath('/onboarding')).toBe('/onboarding');
  });

  it('blocks open redirects', () => {
    expect(safeAuthRedirectPath('https://evil.com')).toBe('/dashboard');
    expect(safeAuthRedirectPath('//evil.com')).toBe('/dashboard');
    expect(safeAuthRedirectPath('/admin/delete-all')).toBe('/dashboard');
  });

  it('defaults null to dashboard', () => {
    expect(safeAuthRedirectPath(null)).toBe('/dashboard');
  });
});
