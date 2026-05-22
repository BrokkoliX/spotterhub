import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import SignUpPage from '../app/signup/page';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockMutation = vi.fn();

vi.mock('urql', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Provider: ({ children }: { children: React.ReactNode }) => children,
    useMutation: vi.fn(() => [{ data: null }, mockMutation]),
    useQuery: vi.fn(() => [{ data: null, fetching: false }]),
  };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SignUpPage', () => {
  beforeEach(() => {
    mockMutation.mockReset();
  });

  it('renders all required form fields', () => {
    render(<SignUpPage />);

    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Username')).toBeTruthy();
    // The display-name label is "Name (optional)" — query by partial label
    // match rather than the bare "Name" string which collides with other
    // page text.
    expect(screen.getByLabelText(/Name.*optional/i)).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeTruthy();
  });

  it('disables the submit button until terms are accepted', () => {
    render(<SignUpPage />);

    const button = screen.getByRole('button', { name: /sign up/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    const termsCheckbox = screen.getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(termsCheckbox);

    expect(button.disabled).toBe(false);
  });

  it('renders the Terms link with target="_blank" and href="/terms"', () => {
    render(<SignUpPage />);

    const termsLink = screen.getByText('Terms of Service').closest('a');
    expect(termsLink?.getAttribute('href')).toBe('/terms');
    expect(termsLink?.getAttribute('target')).toBe('_blank');
  });

  it('enforces password min length of 8', () => {
    render(<SignUpPage />);

    const password = screen.getByLabelText('Password') as HTMLInputElement;
    expect(password.minLength).toBe(8);
    expect(password.required).toBe(true);
    expect(password.type).toBe('password');
  });

  it('enforces username min/max length constraints', () => {
    render(<SignUpPage />);

    const username = screen.getByLabelText('Username') as HTMLInputElement;
    expect(username.minLength).toBe(3);
    expect(username.maxLength).toBe(30);
    expect(username.required).toBe(true);
  });

  it('calls the signUp mutation with the entered values on submit', async () => {
    mockMutation.mockResolvedValueOnce({ data: { signUp: { user: { id: '1' } } } });
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longpassword' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(mockMutation).toHaveBeenCalledWith({
        input: {
          email: 'new@example.com',
          username: 'newuser',
          password: 'longpassword',
          displayName: undefined,
          acceptTerms: true,
        },
      });
    });
  });

  it('shows the success "check your email" view after a successful signup', async () => {
    mockMutation.mockResolvedValueOnce({ data: { signUp: { user: { id: '1' } } } });
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longpassword' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText('Check your email')).toBeTruthy();
    expect(screen.getByText('new@example.com')).toBeTruthy();
  });

  it('shows the GraphQL error message when the mutation returns an error', async () => {
    mockMutation.mockResolvedValueOnce({
      error: {
        graphQLErrors: [{ message: 'Email already in use' }],
      },
    });
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'taken' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longpassword' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText('Email already in use')).toBeTruthy();
  });

  it('falls back to a generic error when the mutation error has no graphQLErrors', async () => {
    mockMutation.mockResolvedValueOnce({
      error: { graphQLErrors: [] },
    });
    render(<SignUpPage />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'x@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'x' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'longpassword' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(await screen.findByText(/sign up failed/i)).toBeTruthy();
  });
});
