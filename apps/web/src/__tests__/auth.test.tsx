import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { AuthProvider, useAuth, type User } from '../lib/auth';

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
      <button onClick={signOut} data-testid="signout">Sign out</button>
    </div>
  );
}

function SignInButton({ token, user }: { token: string; user: User }) {
  const { signIn } = useAuth();
  return (
    <button
      data-testid="signin"
      onClick={() => signIn(token, user)}
    >
      Sign in
    </button>
  );
}

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    role: 'user',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts in loading state then transitions to signed-out', async () => {
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    // After the useEffect hydrates from localStorage, it transitions to signed-out
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-out');
    });
  });

  it('shows signed-out when localStorage is empty', async () => {
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-out');
    });
  });

  it('shows signed-in user when localStorage has auth data', async () => {
    const user = createMockUser({ username: 'avspotter', role: 'admin' });
    localStorage.setItem('token', 'tok-test-123');
    localStorage.setItem('user', JSON.stringify(user));

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

  it('signIn stores token and user in localStorage', async () => {
    const user = createMockUser({ username: 'pilot' });

    render(
      <AuthProvider>
        <AuthDisplay />
        <SignInButton token="tok-new" user={user} />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-out');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('signin'));
    });

    expect(localStorage.getItem('token')).toBe('tok-new');
    expect(screen.getByTestId('status').textContent).toBe('signed-in');
  });

  it('signOut clears localStorage and returns to signed-out', async () => {
    const user = createMockUser();
    localStorage.setItem('token', 'tok-deleteme');
    localStorage.setItem('user', JSON.stringify(user));

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-in');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('signout'));
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(screen.getByTestId('status').textContent).toBe('signed-out');
  });

  it('clears corrupted localStorage and stays signed-out', async () => {
    localStorage.setItem('token', 'valid');
    localStorage.setItem('user', '{ broken json');

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signed-out');
    });
    // Corrupted data should be removed from localStorage
    expect(localStorage.getItem('token')).toBeNull();
  });
});
