'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import { HTitle, Money } from './BookingChrome';

/**
 * Vehicle hero + tappable gallery. Tapping a thumbnail promotes it into the
 * hero slot; the active thumbnail is ringed in gold.
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

  return (
    <>
      <div className="relative -mx-4 mt-[-4px] h-[260px] overflow-hidden bg-[#161922]">
        {activePhoto && <Image src={activePhoto} alt={vehicleName} fill sizes="480px" priority className="object-cover object-[50%_52%]" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0D0F14]/10 to-[#0D0F14]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:4px_4px]" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#C8A664]">{operatorName} · From <Money cents={dailyRateCents} />/day</div>
          <HTitle className="mt-2 text-[26px]">{vehicleName}</HTitle>
          <p className="mt-2 flex items-center gap-2 text-[13px] text-[#D7DAE0]"><MapPin size={14} className="text-[#C8A664]" />{city}, {state} · Concierge-approved rental</p>
        </div>
      </div>

      {photos.length > 1 && (
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Vehicle gallery">
          {photos.map((photo, index) => {
            const active = photo === activePhoto;
            return (
              <button
                key={photo}
                type="button"
                onClick={() => setActivePhoto(photo)}
                aria-pressed={active}
                aria-label={`Show ${shortName} photo ${index + 1}`}
                className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg transition"
                style={{
                  border: active ? '1.5px solid #C8A664' : '1px solid #2A2E3A',
                  boxShadow: active ? '0 0 0 1px #C8A664, 0 0 14px rgba(200,166,100,.20)' : 'none',
                }}
              >
                <Image src={photo} alt={`${shortName} photo ${index + 1}`} fill sizes="128px" className="object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
