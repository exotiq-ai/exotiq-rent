import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getPublicVehicleContext } from '@/domain/booking/service';

/**
 * The shareable card itself: this is what unfurls when the share link lands
 * in a text thread or feed. Hype only — no rates, dates, or booking data.
 */
export const alt = 'Reserved on Drive Exotiq';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Mock heroes are local files under public/ — inline them so the card never
 * depends on fetching our own deploy. Live (supabase) URLs stay remote. */
async function heroSrc(url: string): Promise<string | null> {
  if (url.startsWith('http')) return url;
  try {
    const data = await readFile(join(process.cwd(), 'public', url));
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

export default async function ShareCard({ params }: { params: { operatorSlug: string; vehicleSlug: string } }) {
  const result = await getPublicVehicleContext(params.operatorSlug, params.vehicleSlug);
  const vehicle = result?.vehicle;
  const team = result?.team;
  const hero = vehicle ? await heroSrc(vehicle.heroImage) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#0B0D12',
          padding: 28,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            border: '2px solid rgba(200,166,100,0.55)',
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: '#0B0D12',
          }}
        >
          <div
            style={{
              width: 460,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 48px',
              gap: 26,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: '#C8A664', display: 'flex' }} />
              <div style={{ color: '#C8A664', fontSize: 22, letterSpacing: 8, display: 'flex' }}>RESERVED</div>
            </div>
            <div style={{ color: '#F0F2F5', fontSize: 58, lineHeight: 1.1, fontWeight: 600, display: 'flex' }}>
              {vehicle ? vehicle.name : 'An exotic worth the wait'}
            </div>
            <div style={{ color: '#9BA1B0', fontSize: 24, display: 'flex' }}>
              {team ? `${team.city}, ${team.state}` : 'Curated exotic & luxury rentals'}
            </div>
            <div style={{ marginTop: 18, color: '#C8A664', fontSize: 24, letterSpacing: 6, display: 'flex' }}>DRIVE EXOTIQ</div>
          </div>
          <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt=""
                width={680}
                height={570}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#161922', display: 'flex' }} />
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #0B0D12 0%, rgba(11,13,18,0) 30%)',
                display: 'flex',
              }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
