import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import AdminTiersPage from '../app/admin/tiers/page';

// ─── Mocks ───────────────────────────────────────────────────────────────────
//
// AdminTiersPage is superuser-only. These tests assert the access-control
// contract: every non-superuser caller sees "Access denied"; the superuser
// caller does not.

const mockUseAuth = vi.fn();

vi.mock('@/lib/auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('urql', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Provider: ({ children }: { children: React.ReactNode }) => children,
    useMutation: vi.fn(() => [{ fetching: false }, vi.fn()]),
    useQuery: vi.fn(() => [{ data: null, fetching: false }, vi.fn()]),
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdminTiersPage — access control', () => {
  it('shows a loading state while auth is not yet ready', () => {
    mockUseAuth.mockReturnValue({ user: null, ready: false });
    render(<AdminTiersPage />);

    expect(screen.getByText(/Loading/i)).toBeTruthy();
  });

  it.each([
    ['unauthenticated', null],
    ['regular user', { id: '1', role: 'user' }],
    ['moderator', { id: '1', role: 'moderator' }],
    ['admin', { id: '1', role: 'admin' }],
  ])('shows "Access denied" for %s', (_label, user) => {
    mockUseAuth.mockReturnValue({ user, ready: true });
    render(<AdminTiersPage />);

    expect(screen.getByText(/Access denied/i)).toBeTruthy();
  });

  it('grants access to a superuser', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'superuser' },
      ready: true,
    });
    const { queryByText } = render(<AdminTiersPage />);

    expect(queryByText(/Access denied/i)).toBeNull();
  });
});
