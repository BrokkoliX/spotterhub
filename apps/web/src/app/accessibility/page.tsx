import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility Statement — SpotterSpace',
  description: 'SpotterSpace commitment to web accessibility and WCAG 2.1 compliance.',
};

export default function AccessibilityPage() {
  return (
    <div style={{ padding: '48px 0' }}>
      <div className="container-narrow">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 24 }}>
          Accessibility Statement
        </h1>

        <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Our Commitment
            </h2>
            <p>
              SpotterSpace is committed to ensuring digital accessibility for people with
              disabilities. We continually improve the user experience for everyone and
              apply relevant accessibility standards.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Conformance Status
            </h2>
            <p>
              Our goal is to conform to the{' '}
              <strong>Web Content Accessibility Guidelines (WCAG) 2.1</strong> at Level AA.
              These guidelines explain how to make web content more accessible to people
              with disabilities and more user-friendly for everyone.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Measures We Have Taken
            </h2>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>
                <strong>Semantic HTML</strong> — We use proper heading hierarchy, landmarks,
                and ARIA roles to support screen readers
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Keyboard navigation</strong> — All interactive elements are
                reachable and operable via keyboard
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Color contrast</strong> — Text and UI elements meet minimum
                contrast ratios (4.5:1 for normal text, 3:1 for large text)
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Focus indicators</strong> — Visible focus states on all interactive
                elements for keyboard users
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Alt text</strong> — Users are prompted to add descriptions to
                their photos; photo cards include descriptive text
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Forms</strong> — All form fields have associated labels;
                error messages are clear and descriptive
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Dark and light themes</strong> — Theme toggle ensures comfortable
                viewing regardless of lighting conditions
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Known Limitations
            </h2>
            <p style={{ marginBottom: 8 }}>
              While we strive for accessibility, you may encounter some limitations:
            </p>
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>
                <strong>Photo content</strong> — User-uploaded photos may not have
                text alternatives; we prompt users to add descriptions but cannot
                guarantee compliance
              </li>
              <li style={{ marginBottom: 8 }}>
                <strong>Third-party content</strong> — Embedded map tiles (OpenStreetMap)
                and external links are provided by third parties and may not be fully
                accessible
              </li>
              <li>
                <strong>Legacy content</strong> — Older forum posts and community content
                may predate our accessibility improvements
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Feedback and Contact
            </h2>
            <p>
              We welcome feedback on the accessibility of SpotterSpace. If you experience
              barriers to access, please contact us:
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>Email:</strong> legal@spotterspace.com<br />
              <strong>Subject:</strong> Accessibility Issue
            </p>
            <p style={{ marginTop: 8 }}>
              We aim to respond to accessibility feedback within 5 business days.
              For urgent access issues, please describe the problem in detail so we can
              assist you effectively.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Assessment Approach
            </h2>
            <p>
              Accessibility is assessed through a combination of automated testing (ESLint
              a11y rules, axe), manual keyboard testing, and periodic review against WCAG 2.1
              criteria. We use both light and dark themes during testing.
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
