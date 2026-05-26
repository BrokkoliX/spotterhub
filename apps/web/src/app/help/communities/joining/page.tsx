import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Joining a Community — SpotterSpace Help',
};

export default function JoiningCommunityPage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Joining a community</h1>
        <p className={styles.articleDescription}>
          Find and join communities organized around your aviation interests.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Finding communities</h2>
        <div className={styles.body}>
          <p>
            Visit the <Link href="/communities">Communities page</Link> to browse all available
            communities. You can search by name or filter by category (airport spotters, airshows,
            airline groups, and more). Public communities can be joined immediately; invite-only
            communities require a code from the community admin.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Joining a public community</h2>
        <div className={styles.body}>
          <p>
            On any community page, click the &quot;Join&quot; button. You&apos;ll become a member
            immediately and can start posting photos, joining threads, and RSVPing to events. To
            leave, click &quot;Leave&quot; on the same community page.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Joining an invite-only community</h2>
        <div className={styles.body}>
          <p>
            If a community is invite-only, you&apos;ll need a join code from the community owner or
            admin. Enter the code on the community&apos;s page or on the
            <Link href="/communities"> Communities page</Link> to gain access.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Community roles</h2>
        <div className={styles.body}>
          <p>Communities have four role levels:</p>
          <ul>
            <li>
              <strong>Owner</strong> — Created the community, manages all settings and members.
            </li>
            <li>
              <strong>Admin</strong> — Manages members, posts, and forum. Appointed by the owner.
            </li>
            <li>
              <strong>Moderator</strong> — Can remove posts and manage the moderation queue.
            </li>
            <li>
              <strong>Member</strong> — Can post photos and participate in discussions.
            </li>
          </ul>
          <p>
            If you&apos;re an admin or owner and need to adjust someone&apos;s role, go to the
            community&apos;s Admin panel.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Community features</h2>
        <div className={styles.body}>
          <p>Once a member, you can:</p>
          <ul>
            <li>Upload photos to the community&apos;s photo feed</li>
            <li>Create and reply to forum threads</li>
            <li>RSVP to community events</li>
            <li>View member lists and community stats</li>
          </ul>
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
