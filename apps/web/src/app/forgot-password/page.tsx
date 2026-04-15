'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useMutation } from 'urql';

import { REQUEST_PASSWORD_RESET } from '@/lib/queries';

import styles from './page.module.css';

export default function ForgotPasswordPage() {
  const [, executeMutation] = useMutation(REQUEST_PASSWORD_RESET);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await executeMutation({ email });

    setLoading(false);

    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? 'Failed to send email');
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>
            If an account with that email exists, we&apos;ve sent password reset instructions to it.
          </p>
          <p className={styles.switchText}>
            Remember your password?{' '}
            <Link href="/signin" className={styles.switchLink}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Forgot password</h1>
        <p className={styles.subtitle}>
          Enter your email and we&apos;ll send you reset instructions.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading ? 'Sending…' : 'Send reset email'}
          </button>
        </form>

        <p className={styles.switchText}>
          Remember your password?{' '}
          <Link href="/signin" className={styles.switchLink}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
