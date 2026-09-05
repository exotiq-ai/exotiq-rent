import type { MarketplaceListing } from '@/domain/booking/publicContracts';
import { ListingCard, type ListingCardContext } from './ListingCard';

/**
 * The grid spine from the mockup (MP-12). Marketplace: 1 → 2 → 3 columns at
 * a 24px gutter. Storefront: the phone frame's 16px rhythm and single column
 * below lg (unchanged from before), two columns at 24px from lg.
 */
export function ListingGrid({ listings, dates, variant = 'marketplace' }: { listings: MarketplaceListing[]; dates?: { start: string; end: string }; variant?: ListingCardContext }) {
  const storefront = variant === 'storefront';
  return (
    <div className={storefront ? 'grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6' : 'grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3'}>
      {listings.map((listing, index) => (
        <ListingCard
          key={`${listing.team.slug}/${listing.vehicle.slug}`}
          listing={listing}
          // The storefront hero already owns the LCP; its cards stay lazy.
          priority={!storefront && index < 3}
          dates={dates}
          context={variant}
          sizes={storefront ? '(min-width: 1024px) 400px, 448px' : undefined}
        />
      ))}
    </div>
  );
}
