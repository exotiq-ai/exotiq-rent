'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { HTitle, Money } from './BookingChrome';

/**
 * Vehicle hero + tappable gallery. Tapping a thumbnail promotes it into the
 * hero slot; the active thumbnail is ringed in gold.
 *
 * Auction-catalogue order: image → thumbnails → title block. Nothing sits on the
 * photo.
 *
 * The title used to be overlaid on the hero, which forced a trade this page
 * cannot afford: the scrim needed to make gold and white type legible also
 * darkened the bottom of the car, and on a black vehicle the wheels and lower
 * body disappeared into it. Legible text or a visible car, not both. Moving the
 * type onto the page surface removes the trade — and matches the storefront
 * card, the confirmation screen and the share card, all of which keep text off
 * tenant photos. Text never touches a photo we did not art-direct.
 *
 * The title sits BELOW the thumbnails, not between them and the hero: the strip
 * has to stay adjacent to the image it controls or it stops reading as that
 * image's gallery.
 */
export function VehicleGallery({
  vehicleName,
  shortName,
  heroImage,
  photos,
  operatorName,
  dailyRateCents,
  city,
  state,
}: {
  vehicleName: string;
  shortName: string;
  heroImage: string;
  photos: string[];
  operatorName: string;
  dailyRateCents: number;
  city: string;
  state: string;
}) {
  const [activePhoto, setActivePhoto] = useState(heroImage);
  // Photo URLs come from tenant data and can die under us (expired signed
  // tokens, deleted storage objects). A broken frame is worse than no photo:
  // drop failed URLs and degrade to the same dark-surface placeholder the
  // confirmation screen uses.
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const markFailed = (url: string) => setFailedPhotos((prev) => (prev.includes(url) ? prev : [...prev, url]));
  const gallery = photos.filter((photo) => photo && !failedPhotos.includes(photo));
  const hero = activePhoto && !failedPhotos.includes(activePhoto) ? activePhoto : gallery[0];

  return (
    <>
      {/* No scrim. Nothing sits over the photo any more, so the car keeps its full
          frame — including the lower body and wheels the old gradient ate. */}
      <div className="relative -mx-4 mt-[-4px] aspect-[4/3] overflow-hidden bg-[#161922] lg:mx-0 lg:mt-0 lg:aspect-[16/10] lg:rounded-2xl">
        {hero
          ? <Image src={hero} alt={vehicleName} fill sizes="(min-width: 1024px) 800px, 480px" priority className="object-cover object-[50%_52%]" onError={() => markFailed(hero)} />
          : <div className="absolute inset-0 bg-gradient-to-br from-[#1E2230] to-[#0D0F14]" />}
      </div>

      {gallery.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0" aria-label="Vehicle gallery">
          {gallery.map((photo, index) => {
            const active = photo === hero;
            return (
              <button
                key={photo}
                type="button"
                onClick={() => setActivePhoto(photo)}
                aria-pressed={active}
                aria-label={`Show ${shortName} photo ${index + 1}`}
                className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg transition lg:h-24 lg:w-40"
                style={{
                  border: active ? '1.5px solid #C8A664' : '1px solid #2A2E3A',
                  boxShadow: active ? '0 0 0 1px #C8A664, 0 0 14px rgba(200,166,100,.20)' : 'none',
                }}
              >
                <Image src={photo} alt={`${shortName} photo ${index + 1}`} fill sizes="(min-width: 1024px) 160px, 128px" className="object-cover" onError={() => markFailed(photo)} />
              </button>
            );
          })}
        </div>
      )}

      {/* Title on the page surface, after the gallery. Same rule as the storefront
          card: gold and white type only ever sit on #0D0F14 or #161922, never on a
          photo, so contrast is a property of the design rather than a property of
          whichever image a tenant uploaded. */}
      <div className="mt-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#C8A664]">{operatorName} · From <Money cents={dailyRateCents} />/day</div>
        <HTitle className="mt-2 text-[26px] lg:text-[36px]">{vehicleName}</HTitle>
        <p className="mt-2 flex items-center gap-2 text-[13px] text-[#9BA1B0]"><MapPin size={14} className="text-[#C8A664]" />{city}, {state} · Concierge-approved rental</p>
      </div>
    </>
  );
}
