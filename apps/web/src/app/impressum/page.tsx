import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum — SpotterSpace',
  description: 'Legal information and contact details for SpotterSpace.',
};

export default function ImpressumPage() {
  return (
    <div style={{ padding: '48px 0' }}>
      <div className="container-narrow">
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 24 }}>
          Impressum
        </h1>

        <div style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Angaben gemäß § 5 TMG
            </h2>
            <p>SpotterSpace</p>
            <p>E-Mail: legal@spotterspace.com</p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Verantwortlich für den Inhalt
            </h2>
            <p>Robert Szekely</p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Haftungsausschluss
            </h2>
            <p style={{ marginBottom: 12 }}>
              Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt.
              Der Anbieter übernimmt jedoch keine Gewähr für die Richtigkeit, Vollständigkeit
              und Aktualität der bereitgestellten Inhalte.
            </p>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen
              Seiten nach den allgemeinen Gesetzen verantwortlich. Wir sind nach §§ 8 bis 10 TMG
              jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
              überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
              Urheberrecht
            </h2>
            <p>
              Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
              unterliegen dem Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet.
              Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb
              der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
