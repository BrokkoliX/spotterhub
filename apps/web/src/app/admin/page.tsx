'use client';

import Link from 'next/link';
import { useQuery } from 'urql';

import { useAuth } from '@/lib/auth';
import { ADMIN_STATS } from '@/lib/queries';

import styles from './page.module.css';

export default function AdminDashboard() {
  const { user, ready } = useAuth();
  const isAdmin = user && (user.role === 'admin' || user.role === 'moderator' || user.role === 'superuser');

  const [{ data, fetching }] = useQuery({
    query: ADMIN_STATS,
    pause: !isAdmin,
  });

  if (!ready) return <div className={styles.loading}>Loading…</div>;
  if (!isAdmin) return <div className={styles.denied}>Access denied</div>;

  const stats = data?.adminStats;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Admin Dashboard</h1>

      {fetching && <div className={styles.loading}>Loading stats…</div>}

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalUsers}</span>
            <span className={styles.statLabel}>Users</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalPhotos}</span>
            <span className={styles.statLabel}>Photos</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.pendingPhotos}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.openReports}</span>
            <span className={styles.statLabel}>Open Reports</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalAirports}</span>
            <span className={styles.statLabel}>Airports</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats.totalSpottingLocations}</span>
            <span className={styles.statLabel}>Spotting Locations</span>
          </div>
        </div>
      )}

      <div className={styles.quickLinks}>
        <Link href="/admin/reports" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>🚩</span>
          <div>
            <div className={styles.quickLinkLabel}>Reports</div>
            <div className={styles.quickLinkDesc}>Review flagged content</div>
          </div>
        </Link>
        <Link href="/admin/users" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>👥</span>
          <div>
            <div className={styles.quickLinkLabel}>Users</div>
            <div className={styles.quickLinkDesc}>Manage roles &amp; status</div>
          </div>
        </Link>
        <Link href="/admin/photos" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📷</span>
          <div>
            <div className={styles.quickLinkLabel}>Photos</div>
            <div className={styles.quickLinkDesc}>Moderate uploads</div>
          </div>
        </Link>
        <Link href="/admin/aircraft" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>🛩️</span>
          <div>
            <div className={styles.quickLinkLabel}>Aircraft</div>
            <div className={styles.quickLinkDesc}>Individual registrations</div>
          </div>
        </Link>
        <Link href="/admin/airports" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>🛫</span>
          <div>
            <div className={styles.quickLinkLabel}>Airports</div>
            <div className={styles.quickLinkDesc}>Manage airports</div>
          </div>
        </Link>
        <Link href="/admin/manufacturers" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>🏭</span>
          <div>
            <div className={styles.quickLinkLabel}>Manufacturers</div>
            <div className={styles.quickLinkDesc}>Aircraft manufacturers</div>
          </div>
        </Link>
        <Link href="/admin/families" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📁</span>
          <div>
            <div className={styles.quickLinkLabel}>Families</div>
            <div className={styles.quickLinkDesc}>Aircraft families</div>
          </div>
        </Link>
        <Link href="/admin/variants" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>✈️</span>
          <div>
            <div className={styles.quickLinkLabel}>Variants</div>
            <div className={styles.quickLinkDesc}>Aircraft variants</div>
          </div>
        </Link>
        <Link href="/admin/airlines" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>✈️</span>
          <div>
            <div className={styles.quickLinkLabel}>Airlines</div>
            <div className={styles.quickLinkDesc}>Airlines &amp; operators</div>
          </div>
        </Link>
        <Link href="/admin/photo-categories" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📸</span>
          <div>
            <div className={styles.quickLinkLabel}>Photo Categories</div>
            <div className={styles.quickLinkDesc}>Cabin, cockpit, exterior…</div>
          </div>
        </Link>
        <Link href="/admin/aircraft-specific-categories" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>🛩️</span>
          <div>
            <div className={styles.quickLinkLabel}>Aircraft Categories</div>
            <div className={styles.quickLinkDesc}>Vintage, narrowbody, widebody…</div>
          </div>
        </Link>
        <Link href="/admin/forum-categories" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>💬</span>
          <div>
            <div className={styles.quickLinkLabel}>Forum Categories</div>
            <div className={styles.quickLinkDesc}>Global forum sections &amp; topics</div>
          </div>
        </Link>
        <Link href="/admin/pending-list-items" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📋</span>
          <div>
            <div className={styles.quickLinkLabel}>Pending List Items</div>
            <div className={styles.quickLinkDesc}>User-submitted additions</div>
          </div>
        </Link>
        <Link href="/admin/settings" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>⚙️</span>
          <div>
            <div className={styles.quickLinkLabel}>General Settings</div>
            <div className={styles.quickLinkDesc}>Photo limits, site config</div>
          </div>
        </Link>
        <Link href="/admin/settings/ads" className={styles.quickLink}>
          <span className={styles.quickLinkIcon}>📺</span>
          <div>
            <div className={styles.quickLinkLabel}>Ad Settings</div>
            <div className={styles.quickLinkDesc}>Google AdSense configuration</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
