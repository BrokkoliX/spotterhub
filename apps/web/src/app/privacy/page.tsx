import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — SpotterSpace',
  description: 'How SpotterSpace collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  return (
    <div style={{ padding: '48px 0' }}>
      <div className="container-narrow">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 24 }}>
          Privacy Policy
        </h1>

        <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              1. Data We Collect
            </h2>
            <p style={{ marginBottom: 8 }}>
              SpotterSpace collects information you provide directly, including:
            </p>
            <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
              <li>Account information (email address, username, password hash)</li>
              <li>Profile information (display name, bio, avatar, location, camera gear)</li>
              <li>Photos you upload, including metadata (aircraft type, airline, airport, location, tags)</li>
              <li>Community memberships and forum activity</li>
              <li>Notification preferences</li>
            </ul>
            <p>
              When you sign in via third-party providers (e.g., Google), we receive the
              information provided by that provider.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              2. How We Use Your Data
            </h2>
            <p style={{ marginBottom: 8 }}>
              We use collected information to:
            </p>
            <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
              <li>Provide and maintain the SpotterSpace service</li>
              <li>Process photo uploads and generate image variants</li>
              <li>Display your photos and content to other users</li>
              <li>Send notifications you have opted into</li>
              <li>Moderate content and enforce our terms of service</li>
              <li>Improve the service and develop new features</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              3. Photo Location Data
            </h2>
            <p>
              Photos may include GPS coordinates. You can set a privacy level for each photo:
              <strong> Exact</strong> (visible to all), <strong>Approximate</strong>
              (offset by ~1 km), or <strong>Hidden</strong> (coordinates not shown).
              Even when hidden, approximate location may still be inferred from airport codes.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              4. Data Sharing
            </h2>
            <p>
              We do not sell your personal data. We share data only in these circumstances:
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>With service providers who help us operate (AWS, email delivery via Resend)</li>
              <li>When required by law or valid legal request</li>
              <li>To protect the rights, safety, or property of SpotterSpace or others</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              5. Cookies
            </h2>
            <p>
              We use session cookies for authentication and preferences (theme selection).
              These are essential for the service to function. We do not use advertising or
              tracking cookies.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              6. Your Rights
            </h2>
            <p>
              You have the right to access, correct, or delete your personal data.
              You can update your profile and privacy settings within the app,
              or contact us at legal@spotterspace.com to exercise your rights.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              7. Data Retention
            </h2>
            <p>
              Photos and content remain on SpotterSpace until you delete them or your account.
              Account data is retained as required for legal obligations. Deletion requests are
              processed within 30 days.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              8. Contact
            </h2>
            <p>
              For privacy-related questions, contact us at:<br />
              <strong>legal@spotterspace.com</strong>
            </p>
          </section>

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Last updated: April 2026
          </p>
        </div>
      </div>
    </div>
  );
}
