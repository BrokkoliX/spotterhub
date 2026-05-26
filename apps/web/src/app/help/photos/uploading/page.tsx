import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Uploading Photos — SpotterSpace Help',
};

export default function UploadPhotosPage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Uploading photos</h1>
        <p className={styles.articleDescription}>
          Add your aviation photography to SpotterSpace and share it with the community.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Requirements</h2>
        <div className={styles.body}>
          <p>Photos must meet the following requirements:</p>
          <ul>
            <li>
              <strong>Format:</strong> JPEG, PNG, or WebP
            </li>
            <li>
              <strong>Minimum size:</strong> 1200 pixels on the longest edge
            </li>
            <li>
              <strong>Maximum size:</strong> 30 MB per file
            </li>
            <li>
              <strong>Content:</strong> Aviation-themed photography only. See our content guidelines
              for details.
            </li>
          </ul>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Upload steps</h2>
        <div className={styles.body}>
          <p>
            Navigate to <Link href="/upload">the upload page</Link> (you&apos;ll need to be signed
            in). You&apos;ll be guided through these steps:
          </p>
          <ol>
            <li>
              <strong>Select your photo</strong> — drag and drop or click to browse your files. EXIF
              data is read automatically if present.
            </li>
            <li>
              <strong>Tag the aircraft</strong> — search for the aircraft by registration, type, or
              airline. This helps others discover your photo. You can skip this step if you prefer.
            </li>
            <li>
              <strong>Add location</strong> — click the map to tag where the photo was taken. Choose
              an accuracy level: exact location, approximate (within ~1 km), or hidden.
            </li>
            <li>
              <strong>Write a caption</strong> — describe what&apos;s in the photo. This also helps
              with search.
            </li>
            <li>
              <strong>Choose a license</strong> — select how others can reuse your photo. See{' '}
              <Link href="/help/photos/licensing">Photo licenses</Link> for details.
            </li>
            <li>
              <strong>Add tags</strong> — optional tags to help categorize your photo (e.g.
              &quot;nightshot&quot;, &quot;overhead&quot;, &quot;landing&quot;).
            </li>
            <li>
              <strong>Submit</strong> — your photo will appear in the moderation queue and typically
              be reviewed within a few hours.
            </li>
          </ol>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Moderation</h2>
        <div className={styles.body}>
          <p>
            All photos go through a brief review by our moderation team before appearing in the
            public feed. Most photos are approved within a few hours. If your photo is rejected,
            you&apos;ll see a reason on your <Link href="/my-uploads">uploads page</Link>. You can
            edit and resubmit a rejected photo at any time.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Adding to albums</h2>
        <div className={styles.body}>
          <p>
            Once uploaded, a photo can be added to one of your personal albums. Go to your
            <Link href="/albums"> Albums page</Link>, select an album, and use the &quot;Add
            Photos&quot; button to select photos from your collection.
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
