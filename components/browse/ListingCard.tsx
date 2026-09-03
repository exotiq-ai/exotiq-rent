import Image from 'next/image';
import Link from 'next/link';
import { Money } from '@/components/drive-exotiq/BookingChrome';
import type { MarketplaceListing } from '@/domain/booking/publicContracts';
import { serifStyle } from './tokens';

/**
 * One listing = one car from one operator (MP-3).
 *
 * Same rule as the storefront cards: nothing sits on the photograph except
 * pills that carry their own backdrop. A multi-tenant grid is designed for
 * the worst photo we'll ever be sent, so the name, price and operator live
 * on the solid band where contrast is guaranteed (~7:1) on every image.
 * Card anatomy ported from the cyan mockup; every color from the gold tokens.
 */
export function ListingCard({ listing, priority = false }: { listing: MarketplaceListing; priority?: boolean }) {
  const { team, vehicle, verified } = listing;
  return (
    <Link
      href={`/${team.slug}/${vehicle.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922] transition-colors duration-300 hover:border-[#C8A664]/45 focus-visible:border-[#C8A664] focus-visible:outline-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#1E2230]">
        {vehicle.heroImage ? (
          <Image
            src={vehicle.heroImage}
            alt={vehicle.name}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1E2230] to-[#0D0F14]" />
        )}
        <div className="absolute left-3 top-3 rounded-full border border-[#C8A664]/25 bg-[#0D0F14]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C8A664] backdrop-blur">
          {vehicle.minRentalDays}-day min
        </div>
        {verified && (
          <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-[#6EC1E4]/35 bg-[#0D0F14]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#6EC1E4] backdrop-blur">
            <span aria-hidden>✓</span> Verified
          </div>
        )}
      </div>
      <div className="border-t border-[#2A2E3A] px-4 pb-4 pt-3.5">
        {/* Name gets the full width and up to two lines — at three columns a
            price beside it truncated "2024 McLaren 750S Spider" to "750…". */}
        <h3 className="line-clamp-2 text-[17px] leading-[1.25] text-[#F0F2F5]" style={serifStyle}>
          {vehicle.name}
        </h3>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <div className="min-w-0 truncate text-[12px] text-[#9BA1B0]">
            {team.name} <span className="text-[#848A9A]">· {team.city}, {team.state}</span>
          </div>
          <div className="shrink-0 text-[16px] leading-none text-[#C8A664]">
            <Money cents={vehicle.dailyRateCents} />
            <span className="ml-1 text-[11px] text-[#848A9A]">/day</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
