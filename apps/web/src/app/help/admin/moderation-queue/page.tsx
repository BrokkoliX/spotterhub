import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Moderation Queue — SpotterSpace Help',
};

export default function ModerationQueuePage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Moderation queue</h1>
        <p className={styles.articleDescription}>
          Review, approve, and reject photo submissions as an admin or moderator.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Accessing the queue</h2>
        <div className={styles.body}>
          <p>
            The moderation queue is available at <Link href="/admin/photos">Admin → Photos</Link>.
            You can also open any pending photo directly from the queue and take action from the
            photo detail page. Both require the <strong>admin</strong>, <strong>moderator</strong>,
            or <strong>superuser</strong> role.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Approving a photo</h2>
        <div className={styles.body}>
          <p>
            In the queue, find the photo and click <strong>Approve</strong>. The photo will
            immediately appear in the public feed and the photographer will receive an in-app
            notification. You can also approve a photo directly from the photo detail page — click
            the ✓ Approve button in the moderation banner.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Rejecting a photo</h2>
        <div className={styles.body}>
          <p>
            Click <strong>Reject</strong> on any photo in the queue. You&apos;ll be asked to provide
            an optional reason that will be sent to the photographer. Good reasons help
            photographers improve their submissions and reduce repeat rejections. Examples:
          </p>
          <ul>
            <li>&quot;Image appears to be heavily blurred or out of focus&quot;</li>
            <li>&quot;Duplicate of an existing photo already on the platform&quot;</li>
            <li>&quot;Photo does not appear to be aviation-related&quot;</li>
          </ul>
          <p>
            Rejections are visible on the photographer&apos;s{' '}
            <Link href="/my-uploads">uploads page</Link>, and they can edit and resubmit the photo.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Moderation criteria</h2>
        <div className={styles.body}>
          <p>When reviewing a photo, consider:</p>
          <ul>
            <li>
              <strong>Relevance</strong> — Is it aviation-themed? SpotterSpace focuses on aircraft
              photography.
            </li>
            <li>
              <strong>Quality</strong> — Is the image clear enough to identify the aircraft?
              Acceptable quality varies by context; use judgment.
            </li>
            <li>
              <strong>Originality</strong> — Is it the uploader&apos;s own work? Don&apos;t
              re-upload photos by other photographers without permission.
            </li>
            <li>
              <strong>Content policy</strong> — Does it contain harmful, offensive, or prohibited
              content?
            </li>
            <li>
              <strong>Location accuracy</strong> — Does the tagged location match where the photo
              was taken?
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Filtering the queue</h2>
        <div className={styles.body}>
          <p>
            At the top of the <Link href="/admin/photos">Admin Photos page</Link> use the status
            filter dropdown to switch between <strong>Pending</strong>, <strong>Approved</strong>,
            and <strong>Rejected</strong> views. This is useful when auditing past decisions or
            reviewing photos that were previously rejected.
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
