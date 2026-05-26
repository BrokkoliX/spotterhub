import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Creating an Account — SpotterSpace Help',
};

export default function CreateAccountPage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Creating an account</h1>
        <p className={styles.articleDescription}>
          Get started with SpotterSpace in just a few minutes.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Signing up</h2>
        <div className={styles.body}>
          <p>
            Visit the <Link href="/signup">sign-up page</Link> and enter your email address, choose
            a username, and create a password. Your username is how other users will identify you on
            the platform — it can be changed later in your profile settings.
          </p>
          <p>
            After submitting the form, you&apos;ll receive a verification email at the address you
            provided. Click the link in that email to activate your account. If you don&apos;t see
            the email within a few minutes, check your spam folder.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Choosing a display name</h2>
        <div className={styles.body}>
          <p>
            During sign-up you&apos;ll set both a username (used in URLs like
            <code>/u/yourname</code>) and a display name (shown on your profile and next to your
            photos). Your display name can include spaces and special characters, and can be updated
            at any time from <Link href="/settings/profile">Settings → Profile</Link>.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Email verification problems</h2>
        <div className={styles.body}>
          <p>If your verification email doesn&apos;t arrive:</p>
          <ul>
            <li>
              Double-check that the email address you entered is correct in your profile settings.
            </li>
            <li>
              Add <strong>no-reply@spotterspace.com</strong> to your email contacts or whitelist.
            </li>
            <li>Try requesting a new verification email from the sign-in page.</li>
            <li>Check your spam or junk folder.</li>
          </ul>
          <p>
            If you still don&apos;t receive the email,{' '}
            <Link href="/contact">contact our support team</Link>.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Signing in</h2>
        <div className={styles.body}>
          <p>
            Once your account is verified, go to the <Link href="/signin">sign-in page</Link> and
            enter your email and password. After signing in you&apos;ll be redirected to your feed.
            Your session stays active for up to 7 days — after that you&apos;ll need to sign in
            again.
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
