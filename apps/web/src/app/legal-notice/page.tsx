import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal Notice — SpotterSpace',
  description: 'Legal information and contact details for SpotterSpace.',
};

export default function LegalNoticePage() {
  return (
    <div style={{ padding: '48px 0' }}>
      <div className="container-narrow">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 24 }}>
          Legal Notice
        </h1>

        <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Responsible Person
            </h2>
            <p>Robert Szekely</p>
            <p>Email: legal@spotterspace.com</p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Nature of Business
            </h2>
            <p>
              SpotterSpace is an online platform for aviation photographers to share,
              organize, and discover aircraft photographs.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Disclaimer of Liability
            </h2>
            <p style={{ marginBottom: 12 }}>
              The information on this website is provided as-is without warranty of any kind.
              While we strive for accuracy, we do not guarantee that the content is complete,
              current, or free of errors. Use of this platform is at your own risk.
            </p>
            <p>
              We are not responsible for content uploaded by third parties. Any reliance you
              place on information found on this site is strictly at your own risk.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Copyright
            </h2>
            <p>
              All photographs and content uploaded by users retain the copyright of their
              respective owners. By uploading content to SpotterSpace, you grant us a license
              to host and display it as part of the service. Content created by SpotterSpace
              is protected by copyright. Reproduction or redistribution without prior written
              consent is prohibited.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Dispute Resolution (US)
            </h2>
            <p>
              We are committed to resolving disputes informally. If you have a concern,
              please contact us at legal@spotterspace.com. For US users, this website is
              governed by the laws of the State of Delaware, without regard to its conflict
              of law provisions.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Israeli Users
            </h2>
            <p>
              For users in Israel: SpotterSpace operates in compliance with Israeli consumer
              protection laws. If you have a complaint, you may contact the Consumer Protection
              Department at the Ministry of Economy. Nothing in this notice limits any rights
              you may have under Israeli law.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
