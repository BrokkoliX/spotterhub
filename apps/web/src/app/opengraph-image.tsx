import { ImageResponse } from 'next/og';

// Next.js file convention: /opengraph-image
// Auto-served as a PNG. Auto-included in metadata.openGraph.images for any
// route that doesn't override og:image. 1200x630 is the FB/Twitter recommended
// size for full-width link cards.

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'SpotterSpace — Aviation Photography Community';

export default async function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0b1220 0%, #1e3a5f 100%)',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>SpotterSpace</div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 400,
          opacity: 0.8,
          marginTop: 24,
        }}
      >
        Aviation Photography Community
      </div>
    </div>,
    { ...size },
  );
}
