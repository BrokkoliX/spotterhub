import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Notifications — SpotterSpace Help',
};

export default function NotificationsPage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Notifications</h1>
        <p className={styles.articleDescription}>
          Stay informed about activity on your photos, comments, and follows.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>What you&apos;ll be notified about</h2>
        <div className={styles.body}>
          <p>You&apos;ll receive in-app notifications when:</p>
          <ul>
            <li>Someone likes one of your photos</li>
            <li>Someone comments on your photo or reply</li>
            <li>Someone follows you</li>
            <li>A community you&apos;re in has a new post or event</li>
            <li>Your photo is approved or rejected by a moderator</li>
            <li>Someone replies to your forum thread or post</li>
          </ul>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Reading your notifications</h2>
        <div className={styles.body}>
          <p>
            Click the bell icon 🔔 in the top navigation bar to open the notification panel. Unread
            notifications are highlighted. Click any notification to go directly to the relevant
            page. Use &quot;Mark all read&quot; to clear the unread count.
          </p>
          <p>
            You can also visit the <Link href="/notifications">full notifications page</Link> to see
            your complete history and delete notifications you no longer need.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Email notifications</h2>
        <div className={styles.body}>
          <p>
            Currently, SpotterSpace sends all notifications to the in-app notification center only.
            We do not send email notifications for activity. This means it&apos;s important to check
            your notification bell regularly, especially if you are active in communities or the
            forum.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>No notification emails?</h2>
        <div className={styles.body}>
          <p>
            We do not currently support email notifications. To stay on top of activity, check your
            in-app notifications by clicking the 🔔 icon in the header. We plan to add optional
            email digests in a future update.
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
