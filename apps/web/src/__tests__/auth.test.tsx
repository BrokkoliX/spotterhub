import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { AuthProvider, useAuth, type User } from '../lib/auth';

// Mock Next.js router
vi.mock('next/navigation', () => ({ router: { push: vi.fn() } }));

// ─── Test harness ─────────────────────────────────────────────────────────────

function AuthDisplay() {
  const { user, ready, signIn, signOut } = useAuth();

  if (!ready) return <p data-testid="status">loading</p>;
  if (!user) return <p data-testid="status">signed-out</p>;
  return (
    <div>
      <p data-testid="status">signed-in</p>
      <p data-testid="username">{user.username}</p>
      <p data-testid="role">{user.role}</p>
      <button onClick={() => signOut()} data-testid="signout">Sign out</button>
    </div>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts in loading state then transitions to signed-out when no cookie', async () => {
    // Mock /api/auth/me returning no user
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ user: null }), { status: 200 }),
    );

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('loading');
    });
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-out');
    });
  });

  it('shows signed-in user when cookie is present', async () => {
    // Mock /api/auth/me returning a user
    const mockUser: User = { id: 'user-1', email: 'test@example.com', username: 'avspotter', role: 'admin' };
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ user: mockUser }), { status: 200 }),
    );

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-in');
    });
    expect(screen.getByTestId('username').textContent).toBe('avspotter');
    expect(screen.getByTestId('role').textContent).toBe('admin');
  });

  it('clears auth on fetch error', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-out');
    });
  });
});
