import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../../help.module.css';

export const metadata: Metadata = {
  title: 'Photo Licenses — SpotterSpace Help',
};

export default function PhotoLicensingPage() {
  return (
    <div className={styles.article}>
      <Link href="/help" className={styles.backLink}>
        ← Help Center
      </Link>

      <div className={styles.articleHeader}>
        <h1 className={styles.articleTitle}>Photo licenses</h1>
        <p className={styles.articleDescription}>
          Choose how others can reuse your photos on SpotterSpace.
        </p>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>What is a license?</h2>
        <div className={styles.body}>
          <p>
            When you upload a photo you choose a license that determines what others can do with it.
            The license is displayed on your photo&apos;s detail page and in search results.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Available licenses</h2>
        <div className={styles.body}>
          <p>
            <strong>All Rights Reserved</strong> — No reuse is permitted without your explicit
            permission. Anyone who wants to use your photo must contact you directly. This is the
            default and most restrictive option.
          </p>
          <p>
            <strong>CC BY</strong> — Others can use your photo in any context, including
            commercially, as long as they credit you as the photographer and link back to the
            original on SpotterSpace. This is the most permissive of the Creative Commons licenses
            we offer.
          </p>
          <p>
            <strong>CC BY-NC</strong> — Similar to CC BY, but commercial use is prohibited.
            Non-commercial projects, blogs, and educational content can use your photo with
            attribution.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Changing the license</h2>
        <div className={styles.body}>
          <p>
            You can change the license on any of your photos at any time from your
            <Link href="/my-uploads"> uploads page</Link>. Click the photo, then Edit, and select
            the new license. The change applies going forward and does not affect uses that were
            already happening under the previous license.
          </p>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Marketplace licensing</h2>
        <div className={styles.body}>
          <p>
            Photos listed in the <Link href="/marketplace">Marketplace</Link> operate under a
            separate purchase agreement. Buyers pay for a license to use the photo in exchange for a
            high-resolution file. The license type (All Rights Reserved or Creative Commons) on a
            marketplace listing still governs what the seller permits, and the purchase price covers
            the transaction. If you&apos;re buying a photo through the marketplace, the listing page
            will show exactly what is included.
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
