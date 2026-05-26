import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Changing Your Password — SpotterSpace Help',
};

export default function ChangePasswordPage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Changing your password</h1>
        <p className={styles.articleDescription}>
          Keep your account secure by using a strong, unique password.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>How to change your password</h2>
        <div className={styles.body}>
          <p>
            Go to <Link href="/settings/profile">Settings → Profile</Link> and scroll to the
            Password section. Enter your current password, then choose a new password and confirm
            it. Click Save to apply the change. You&apos;ll be signed out on all devices and asked
            to sign in again with your new password.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Password requirements</h2>
        <div className={styles.body}>
          <p>
            Your password must be at least 8 characters long. For your account&apos;s security, we
            recommend:
          </p>
          <ul>
            <li>At least 12 characters</li>
            <li>A mix of uppercase and lowercase letters</li>
            <li>At least one number or special character</li>
            <li>Avoid using the same password you use on other websites</li>
          </ul>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Forgotten your password?</h2>
        <div className={styles.body}>
          <p>
            If you can&apos;t sign in because you&apos;ve forgotten your password, go to the
            <Link href="/forgot-password"> Forgot password</Link> page and enter your email address.
            We&apos;ll send you a link to reset your password. The link expires after one hour for
            security reasons.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Account lockout</h2>
        <div className={styles.body}>
          <p>
            After 5 failed sign-in attempts, your account is temporarily locked for 15 minutes as a
            protection against brute-force attacks. Wait for the lockout to expire and try again, or
            use the password reset flow if you&apos;re unsure of your password.
          </p>
        </div>
      </div>

      <div className={styles.feedback}>
        <span className={styles.feedbackText}>Was this page helpful?</span>
        <button type="button" className={styles.feedbackBtn}>
          👍 Yes
        </button>
        <button type="button" className={styles.feedbackBtn}>
          👎 No
        </button>
      </div>
    </div>
  );
}
