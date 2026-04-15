import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — SpotterSpace',
  description: 'Terms and conditions for using SpotterSpace.',
};

export default function TermsPage() {
  return (
    <div style={{ padding: '48px 0' }}>
      <div className="container-narrow">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 24 }}>
          Terms of Service
        </h1>

        <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By creating an account or using SpotterSpace, you agree to these terms.
              If you do not agree, do not use the service.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              2. Eligibility
            </h2>
            <p>
              You must be at least 16 years old to create an account. You are responsible
              for ensuring that your use complies with the laws of your jurisdiction.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              3. Your Content
            </h2>
            <p style={{ marginBottom: 8 }}>
              You retain ownership of photos and content you upload. By posting content
              on SpotterSpace, you grant us a non-exclusive, worldwide, royalty-free license
              to host, display, and distribute that content as part of the service.
            </p>
            <p>
              You represent that you own or have the necessary rights to upload your photos,
              and that your content does not infringe the intellectual property or privacy
              rights of any third party.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              4. Prohibited Content
            </h2>
            <p style={{ marginBottom: 8 }}>
              You may not upload content that:
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li>Violates any applicable law or regulation</li>
              <li>Infringes intellectual property, privacy, or other rights of third parties</li>
              <li>Contains nudity, violence, or other material that is harmful or inappropriate</li>
              <li>Is spam, misleading, or promotional without authorization</li>
              <li>Attempts to exploit or harm other users</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              5. Moderation
            </h2>
            <p>
              We reserve the right to review, remove, or restrict access to content that
              violates these terms or community guidelines. Community administrators and
              moderators may take moderation actions within their communities.
              Repeated violations may result in account suspension or termination.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              6. Copyright
            </h2>
            <p>
              We respect intellectual property rights. If you believe your copyright has been
              infringed, contact us at legal@spotterspace.com with the details and we will
              act on valid requests promptly.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              7. Disclaimers
            </h2>
            <p>
              SpotterSpace is provided &ldquo;as is&rdquo; without warranties of any kind.
              We do not guarantee that the service will be uninterrupted, secure, or
              error-free. We reserve the right to modify or discontinue features at any time.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, SpotterSpace shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages arising
              from your use of the service.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              9. Account Termination
            </h2>
            <p>
              You may delete your account at any time. We may suspend or terminate accounts
              that violate these terms. Upon termination, your content may be deleted
              as described in our Privacy Policy.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              10. Changes to Terms
            </h2>
            <p>
              We may update these terms from time to time. Continued use of SpotterSpace
              after changes constitutes acceptance of the new terms.
              We will notify users of significant changes via email or a notice in the app.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Contact
            </h2>
            <p>
              Questions about these terms: <strong>legal@spotterspace.com</strong>
            </p>
          </section>

          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: 32 }}>
            Last updated: April 2026
          </p>
        </div>
      </div>
    </div>
  );
}
