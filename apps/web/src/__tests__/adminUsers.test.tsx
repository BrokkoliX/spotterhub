import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import AdminUsersPage from '../app/admin/users/page';

// ─── Mocks ───────────────────────────────────────────────────────────────────
//
// The Users admin page is now superuser-only. These tests focus on that
// contract: anonymous, regular, moderator, and admin callers must all see
// "Access denied"; superuser must NOT. We mock the codegen'd queries and
// the urql hooks so the page renders hermetically without a real GraphQL
// client.

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

vi.mock('@/lib/generated/graphql', () => ({
  useAdminUsersQuery: vi.fn(() => [{ data: null, fetching: false }, vi.fn()]),
  useAdminUserByIdQuery: vi.fn(() => [{ data: null, fetching: false }, vi.fn()]),
  useAdminTiersQuery: vi.fn(() => [{ data: null, fetching: false }, vi.fn()]),
}));

vi.mock('@/components/Pagination', () => ({
  Pagination: () => null,
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AdminUsersPage — access control', () => {
  it('shows a loading state while auth is not yet ready', () => {
    mockUseAuth.mockReturnValue({ user: null, ready: false });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Loading/i)).toBeTruthy();
  });

  it('shows "Access denied" for an unauthenticated user', () => {
    mockUseAuth.mockReturnValue({ user: null, ready: true });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Access denied/i)).toBeTruthy();
  });

  it('shows "Access denied" for a regular user', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'user' },
      ready: true,
    });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Access denied/i)).toBeTruthy();
  });

  it('shows "Access denied" for a moderator', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'moderator' },
      ready: true,
    });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Access denied/i)).toBeTruthy();
  });

  it('shows "Access denied" for an admin (no longer privileged enough)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'admin' },
      ready: true,
    });
    render(<AdminUsersPage />);

    expect(screen.getByText(/Access denied/i)).toBeTruthy();
  });

  it('grants access to a superuser', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', role: 'superuser' },
      ready: true,
    });
    const { queryByText } = render(<AdminUsersPage />);

    expect(queryByText(/Access denied/i)).toBeNull();
  });
});
