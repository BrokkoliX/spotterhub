'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { SIGN_UP } from '@/lib/queries';

import styles from '../signin/page.module.css';

export default function SignUpPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [, executeMutation] = useMutation(SIGN_UP);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await executeMutation({
      input: { email, username, password },
    });

    if (result.error) {
      setError(result.error.graphQLErrors[0]?.message ?? 'Sign up failed');
      setLoading(false);
      return;
    }

    const { token, user } = result.data.signUp;
    signIn(token, user);
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create account</h1>

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
            <label htmlFor="username" className="label">
              Username
            </label>
            <input
              id="username"
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="avgeek123"
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              title="Letters, numbers, hyphens, and underscores only"
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
              autoComplete="new-password"
              placeholder="Min 8 characters"
              minLength={8}
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>

        <p className={styles.switchText}>
          Already have an account?{' '}
          <Link href="/signin" className={styles.switchLink}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
