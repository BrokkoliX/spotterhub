import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import AdminUsersPage from '../app/admin/users/page';

// ─── Mocks ───────────────────────────────────────────────────────────────────
//
// The admin pages enforce role-based access control client-side. These tests
// focus on that contract: anonymous and non-privileged users must see
// "Access denied"; admin/moderator/superuser roles must NOT. We mock the
// codegen'd admin-users query and the urql mutation hooks to keep the test
// hermetic.

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
    useQuery: vi.fn(() => [{ data: null, fetching: false }]),
  };
});

vi.mock('@/lib/generated/graphql', async () => ({
  useAdminUsersQuery: vi.fn(() => [{ data: null, fetching: false }, vi.fn()]),
}));

vi.mock('@/components/Pagination', () => ({
  Pagination: () => null,
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdminUsersPage — access control', () => {
  it('shows a loading state while auth is not yet ready', () => {
    mockUseAuth.mockReturnValueOnce({ user: null, ready: false });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Loading/i)).toBeTruthy();
  });

  it('shows "Access denied" for an unauthenticated user', () => {
    mockUseAuth.mockReturnValueOnce({ user: null, ready: true });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Access denied/i)).toBeTruthy();
  });

  it('shows "Access denied" for a regular user', () => {
    mockUseAuth.mockReturnValueOnce({
      user: { id: '1', role: 'user' },
      ready: true,
    });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Access denied/i)).toBeTruthy();
  });

  it('grants access to a moderator (read-only — no manage controls)', () => {
    mockUseAuth.mockReturnValueOnce({
      user: { id: '1', role: 'moderator' },
      ready: true,
    });
    const { queryByText } = render(<AdminUsersPage />);

    expect(queryByText(/Access denied/i)).toBeNull();
  });

  it('grants access to an admin', () => {
    mockUseAuth.mockReturnValueOnce({
      user: { id: '1', role: 'admin' },
      ready: true,
    });
    const { queryByText } = render(<AdminUsersPage />);

    expect(queryByText(/Access denied/i)).toBeNull();
  });

  it('grants access to a superuser', () => {
    mockUseAuth.mockReturnValueOnce({
      user: { id: '1', role: 'superuser' },
      ready: true,
    });
    const { queryByText } = render(<AdminUsersPage />);

    expect(queryByText(/Access denied/i)).toBeNull();
  });
});
