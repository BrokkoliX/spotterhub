import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Finding Photos — SpotterSpace Help',
};

export default function FindingPhotosPage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Finding photos</h1>
        <p className={styles.articleDescription}>
          Discover and explore aviation photography from around the world.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>The feed</h2>
        <div className={styles.body}>
          <p>
            Your home feed on <Link href="/">the home page</Link> shows photos uploaded by people
            you follow. If you&apos;re new and haven&apos;t followed anyone yet, you&apos;ll see
            recently uploaded photos from across the community. Follow photographers whose work you
            like to fill your feed with photos you care about.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Explore page</h2>
        <div className={styles.body}>
          <p>
            The <Link href="/explore">Explore page</Link> is a great way to discover new content and
            find interesting topics to follow. You can browse by category — aircraft types,
            airlines, manufacturers, and more. Click any topic to see all photos tagged with it, and
            hit Follow to add it to your personal feed.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>World map</h2>
        <div className={styles.body}>
          <p>
            The <Link href="/map">Map page</Link> lets you browse photos pinned to locations around
            the world. Click any pin to see photos taken near that spot. Use the filters to narrow
            down by aircraft type, airline, or time period.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Search</h2>
        <div className={styles.body}>
          <p>
            Use the search bar at the top of any page (or press <strong>⌘K</strong> /
            <strong>Ctrl+K</strong>) to search for photos, users, airlines, aircraft registrations,
            or airports. Search results are instant and filterable.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Communities and forums</h2>
        <div className={styles.body}>
          <p>
            <Link href="/communities">Communities</Link> are groups organized around shared
            interests — airports, events, photographer groups, and more. Each community has its own
            photo feed, forum, and event calendar. <Link href="/forum">The Forum</Link> is a global
            discussion board for aviation topics of all kinds.
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
