import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SignInPage from '../app/signin/page';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockSignIn = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
    usePathname: () => '/signin',
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ signIn: mockSignIn, signOut: vi.fn(), user: null, refresh: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SignInPage', () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockPush.mockReset();
  });

  it('renders the sign-in form with email and password fields', () => {
    render(<SignInPage />);

    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
  });

  it('renders a forgot-password link pointing to /forgot-password', () => {
    render(<SignInPage />);

    const forgotLink = screen.getByText(/forgot password/i).closest('a');
    expect(forgotLink?.getAttribute('href')).toBe('/forgot-password');
  });

  it('renders a sign-up link pointing to /signup', () => {
    render(<SignInPage />);

    const signUpLink = screen.getByText('Sign up').closest('a');
    expect(signUpLink?.getAttribute('href')).toBe('/signup');
  });

  it('calls signIn with the entered email and password on submit', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Wait one microtask for the async submit handler to schedule signIn
    await Promise.resolve();
    expect(mockSignIn).toHaveBeenCalledWith('user@example.com', 'secret123');
  });

  it('navigates to / on successful sign in', async () => {
    mockSignIn.mockResolvedValueOnce(undefined);
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows an error message when signIn rejects with an Error', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('Invalid email or password'));
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('falls back to a generic error when signIn rejects with a non-Error value', async () => {
    mockSignIn.mockRejectedValueOnce('weird string error');
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/sign in failed/i)).toBeTruthy();
  });

  it('disables the submit button while the sign-in request is in flight', async () => {
    let resolveSignIn: (() => void) | undefined;
    mockSignIn.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // While in flight, the button should now read "Signing in…" and be disabled
    const button = screen.getByRole('button', { name: /signing in/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Resolve the in-flight request so the test cleans up
    resolveSignIn?.();
    await Promise.resolve();
  });

  it('requires both email and password fields (HTML5 validation attributes set)', () => {
    render(<SignInPage />);

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;

    expect(emailInput.required).toBe(true);
    expect(emailInput.type).toBe('email');
    expect(passwordInput.required).toBe(true);
    expect(passwordInput.type).toBe('password');
  });
});
