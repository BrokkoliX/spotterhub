'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { VERIFY_EMAIL } from '@/lib/queries';

import styles from '../signin/page.module.css';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [, executeMutation] = useMutation(VERIFY_EMAIL);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from URL param requires setState in an effect
      setStatus('error');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from URL param requires setState in an effect
      setErrorMessage('Missing verification token.');
      return;
    }

    executeMutation({ token })
      .then((result) => {
        if (result.error) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- async mutation result requires setState in effect
          setStatus('error');
          // eslint-disable-next-line react-hooks/set-state-in-effect -- async mutation result requires setState in effect
          setErrorMessage(result.error.graphQLErrors[0]?.message ?? 'Verification failed');
          return;
        }

        const { token: jwt, user } = result.data.verifyEmail;
        signIn(jwt, user);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async mutation result requires setState in effect
        setStatus('success');
      });
  }, [searchParams, executeMutation, signIn]);

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Verifying your email…</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Please wait while we confirm your email address.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Email verified!</h1>
          <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            Your account is now active.
          </p>
          <p style={{ textAlign: 'center' }}>
            <Link href="/" className="btn btn-primary">
              Go to SpotterSpace
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Verification failed</h1>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          {errorMessage}
        </p>
        <p style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/signin" className="btn btn-secondary">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.card}>
            <h1 className={styles.title}>Loading…</h1>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
