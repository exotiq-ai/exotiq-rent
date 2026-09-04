import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { Money } from '@/components/drive-exotiq/BookingChrome';
import type { MarketplaceListing } from '@/domain/booking/publicContracts';
import { SaveButton } from '@/components/renters/SaveButton';
import { cardShellClassName, photoClassName, photoFrameClassName, priceClassName, priceUnitClassName, serifStyle } from './tokens';

/**
 * One listing = one car from one operator (MP-3).
 *
 * Same rule as the storefront cards: nothing sits on the photograph except
 * pills that carry their own backdrop. A multi-tenant grid is designed for
 * the worst photo we'll ever be sent, so the name, price and operator live
 * on the solid band where contrast is guaranteed (~7:1) on every image.
 * Card anatomy ported from the cyan mockup; every color from the gold tokens.
 * MP-11: the card lifts on hover (the physical cue the mockup had), the
 * price carries weight, and a flex column pins the price row to the bottom
 * so a row mixing one- and two-line names keeps one baseline.
 */
export function ListingCard({ listing, priority = false, dates }: { listing: MarketplaceListing; priority?: boolean; dates?: { start: string; end: string } }) {
  const { team, vehicle, verified } = listing;
  // A renter who filtered by dates carries them to the car and into booking.
  const href = dates ? `/${team.slug}/${vehicle.slug}?start=${dates.start}&end=${dates.end}` : `/${team.slug}/${vehicle.slug}`;
  return (
    <div className={`group h-full ${cardShellClassName}`}>
    <Link
      href={href}
      className="flex h-full flex-col focus-visible:outline-none"
    >
      <div className={photoFrameClassName}>
        {vehicle.heroImage ? (
          <Image
            src={vehicle.heroImage}
            alt={vehicle.name}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
            className={photoClassName}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1E2230] to-[#0D0F14]" />
        )}
        <div className="absolute left-3 top-3 rounded-full border border-[#C8A664]/25 bg-[#0D0F14]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C8A664] backdrop-blur">
          {vehicle.minRentalDays}-day min
        </div>
        {verified && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-[#6EC1E4]/35 bg-[#0D0F14]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6EC1E4] backdrop-blur">
            <BadgeCheck size={11} strokeWidth={2.25} aria-hidden /> Verified
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col border-t border-[#2A2E3A] px-4 pb-4 pt-3.5">
        {/* Name gets the full width and up to two lines — at three columns a
            price beside it truncated "2024 McLaren 750S Spider" to "750…". */}
        <h3 className="line-clamp-2 text-[17px] leading-[1.25] text-[#F0F2F5]" style={serifStyle}>
          {vehicle.name}
        </h3>
        <div className="mt-auto flex items-baseline justify-between gap-4 pt-2">
          <div className="min-w-0 truncate text-[12px] text-[#9BA1B0]">
            {team.name} <span className="text-[#848A9A]">· {team.city}, {team.state}</span>
          </div>
          <div className={priceClassName}>
            <Money cents={vehicle.dailyRateCents} />
            <span className={priceUnitClassName}>per day</span>
          </div>
        </div>
      </div>
    </Link>
      {/* The heart sits over the photo's corner but outside the link: an
          overlay the exact height of the 4:3 frame, clicks pass through
          everywhere except the button (MP-14). Hidden when capture is off. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/3]">
        <SaveButton car={{ team_slug: team.slug, vehicle_slug: vehicle.slug, name: vehicle.name, href: `/${team.slug}/${vehicle.slug}`, priceCents: vehicle.dailyRateCents }} className="pointer-events-auto absolute bottom-3 right-3" />
      </div>
    </div>
  );
}
