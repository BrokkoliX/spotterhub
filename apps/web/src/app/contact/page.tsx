'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from 'urql';

import { useAuth } from '@/lib/auth';
import { CREATE_CONTACT_MESSAGE } from '@/lib/queries';

import styles from './page.module.css';

export default function ContactPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [{ fetching }, createMessage] = useMutation(CREATE_CONTACT_MESSAGE);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auth guard
  if (!ready) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.loading}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.replace('/signin?redirect=/contact');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }

    if (body.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }

    if (body.trim().length > 2000) {
      setError('Message must be at most 2000 characters');
      return;
    }

    const result = await createMessage({
      input: { subject: subject.trim(), body: body.trim() },
    });

    if (result.error) {
      setError(result.error.graphQLErrors?.[0]?.message ?? 'Failed to send message');
      return;
    }

    setSuccess(true);
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>✉️</div>
            <h1 className={styles.successTitle}>Message Sent!</h1>
            <p className={styles.successText}>
              Thank you for reaching out. Our team will get back to you soon.
            </p>
            <Link href="/" className="btn btn-secondary">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.header}>
          <Link href="/" className={styles.backLink}>
            ← Back
          </Link>
          <h1 className={styles.title}>Contact Us</h1>
          <p className={styles.subtitle}>
            Have a question, feedback, or found a bug? Send us a message and we&#39;ll get back to you.
          </p>
        </div>

        <div className={styles.formCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="subject">
                Subject <span className={styles.required}>*</span>
              </label>
              <input
                id="subject"
                type="text"
                className={styles.input}
                placeholder="What is this about?"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="body">
                Message <span className={styles.required}>*</span>
              </label>
              <textarea
                id="body"
                className={styles.textarea}
                placeholder="Describe your question, feedback, or issue in detail…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                maxLength={2000}
              />
              <span className={styles.charCount}>{body.length}/2000</span>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.actions}>
              <Link href="/" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={fetching}
              >
                {fetching ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}