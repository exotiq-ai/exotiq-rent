import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, CarFront, Images } from 'lucide-react';
import { Money } from '@/components/drive-exotiq/BookingChrome';
import type { MarketplaceListing } from '@/domain/booking/publicContracts';
import { storefrontProvenance } from '@/domain/booking/provenance';
import { SaveButton } from '@/components/renters/SaveButton';
import { cardShellClassName, microLabelClassName, photoClassName, photoFrameClassName, priceClassName, priceUnitClassName, serifStyle } from './tokens';

export type ListingCardContext = 'marketplace' | 'storefront';

/**
 * One listing = one car from one operator (MP-3). The ONLY vehicle card
 * (MP-12): the storefront used to carry a hand-rolled copy that drifted.
 *
 * Same rule everywhere: nothing sits on the photograph except pills that
 * carry their own backdrop. A multi-tenant grid is designed for the worst
 * photo we'll ever be sent, so the name, price and operator live on the
 * solid band where contrast is guaranteed (~7:1) on every image.
 * MP-11: the card lifts on hover, the price carries weight, and a flex
 * column pins the price row to the bottom so a row mixing one- and two-line
 * names keeps one baseline. MP-14: the heart is a sibling of the link.
 *
 * `context` decides the meta row: the marketplace names the operator and
 * city (the car's provenance across tenants); a storefront already IS the
 * operator, so it shows year and make. Both add the photo count when there
 * is more than one — a real, live fact, unlike the mockup's fake ratings.
 */
export function ListingCard({
  listing,
  priority = false,
  dates,
  context = 'marketplace',
  sizes = '(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw',
}: {
  listing: MarketplaceListing;
  priority?: boolean;
  dates?: { start: string; end: string };
  context?: ListingCardContext;
  /** next/image sizes for the grid this card sits in. */
  sizes?: string;
}) {
  const { team, vehicle, verified, photoCount } = listing;
  // A renter who filtered by dates carries them to the car and into booking.
  const href = dates ? `/${team.slug}/${vehicle.slug}?start=${dates.start}&end=${dates.end}` : `/${team.slug}/${vehicle.slug}`;
  // Storefront: only what the headline does not already say (see storefrontProvenance).
  const provenance = context === 'storefront' ? storefrontProvenance(vehicle.name, vehicle.year, vehicle.make) : null;
  return (
    <div className={`group h-full ${cardShellClassName}`}>
      <Link href={href} className="flex h-full flex-col focus-visible:outline-none">
        <div className={photoFrameClassName}>
          {vehicle.heroImage ? (
            <Image src={vehicle.heroImage} alt={vehicle.name} fill priority={priority} sizes={sizes} className={photoClassName} />
          ) : (
            <ListingPhotoPlaceholder />
          )}
          <div className={`absolute left-3 top-3 rounded-full border border-[#C8A664]/25 bg-[#0D0F14]/70 px-2.5 py-1 ${microLabelClassName} text-[#C8A664] backdrop-blur`}>
            {vehicle.minRentalDays}-day min
          </div>
          {verified && (
            <div className={`absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-[#6EC1E4]/35 bg-[#0D0F14]/70 px-2.5 py-1 ${microLabelClassName} text-[#6EC1E4] backdrop-blur`}>
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
            <div className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-[#9BA1B0]">
              {provenance !== null ? (
                provenance !== '' && <span className="truncate">{provenance}</span>
              ) : (
                <span className="truncate">{team.name} <span className="text-[#848A9A]">· {team.city}, {team.state}</span></span>
              )}
              {photoCount > 1 && (
                <span className="flex shrink-0 items-center gap-1 text-[#848A9A]">
                  <Images size={14} strokeWidth={1.75} aria-hidden />
                  <span className="tabular-nums">{photoCount}</span>
                  <span className="sr-only">photos</span>
                </span>
              )}
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
        <SaveButton car={{ team_slug: team.slug, vehicle_slug: vehicle.slug, name: vehicle.name, href: `/${team.slug}/${vehicle.slug}`, priceCents: vehicle.dailyRateCents, team_name: team.name }} className="pointer-events-auto absolute bottom-3 right-3" />
      </div>
    </div>
  );
}

/** A tenant with no public hero: says so, quietly, instead of an empty gradient (MP-12). */
export function ListingPhotoPlaceholder() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#1E2230] to-[#0D0F14]">
      <CarFront size={28} strokeWidth={1.5} className="text-[#2A2E3A]" aria-hidden />
      <span className={`absolute bottom-3 ${microLabelClassName} text-[#848A9A]`}>No photos yet</span>
    </div>
  );
}

/** The same shell while a grid streams in — for any future loading state (MP-12). */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922]" aria-hidden>
      <div className="aspect-[4/3] animate-pulse bg-[#1E2230] motion-reduce:animate-none" />
      <div className="space-y-3 border-t border-[#2A2E3A] px-4 pb-4 pt-3.5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[#1E2230] motion-reduce:animate-none" />
        <div className="flex justify-between">
          <div className="h-3 w-1/2 animate-pulse rounded bg-[#1E2230] motion-reduce:animate-none" />
          <div className="h-4 w-16 animate-pulse rounded bg-[#1E2230] motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
