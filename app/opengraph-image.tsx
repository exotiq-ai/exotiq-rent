import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { tone } from '../components/browse/tokens';

/**
 * The floor card (MP-18): what unfurls for any page that has no better image, so no Drive Exotiq
 * link previews bare. Brand only: no photograph, no price, no request data, so it prerenders at
 * build. The hairline is neutral (driver errata #2: gold is punctuation on the app surface; the
 * share card stays the one gold card). Pages with their own openGraph reach it through
 * unfurlImages() in domain/booking/seo.ts, never by inheritance.
 */
export const alt = 'Drive Exotiq';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function FloorCard() {
  const svg = await readFile(join(process.cwd(), 'public', 'images', 'logos', 'drive-exotiq-emblem-white.svg'));
  const emblem = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: tone.ground, padding: 28 }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${tone.line2}`,
            borderRadius: 24,
            gap: 28,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={emblem} alt="" width={300} height={176} />
          <div style={{ display: 'flex', color: tone.ink, fontSize: 72, fontWeight: 600 }}>Drive Exotiq</div>
          <div style={{ display: 'flex', color: tone.muted, fontSize: 30, letterSpacing: 4 }}>{'Curated exotic & luxury rentals'}</div>
        </div>
      </div>
    ),
    size,
  );
}
