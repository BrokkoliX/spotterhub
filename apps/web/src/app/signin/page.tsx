'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { SIGN_IN } from '@/lib/queries';

import styles from './page.module.css';

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [, executeMutation] = useMutation(SIGN_IN);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await executeMutation({ input: { email, password } });

    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? 'Sign in failed');
      setLoading(false);
      return;
    }

    const { token, user } = result.data.signIn;
    signIn(token, user);
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>

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

          <div className="field">
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.switchText}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" className={styles.switchLink}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
