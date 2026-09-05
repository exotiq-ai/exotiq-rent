import type { MarketplaceListing } from '@/domain/booking/publicContracts';
import { ListingCard, type ListingCardContext } from './ListingCard';

/**
 * The grid spine from the mockup, one gutter for both surfaces (MP-12).
 * Marketplace: 1 → 2 → 3 columns. Storefront: one column below lg (the
 * storefront's phone frame is a single column by design), two from lg.
 */
export function ListingGrid({ listings, dates, variant = 'marketplace' }: { listings: MarketplaceListing[]; dates?: { start: string; end: string }; variant?: ListingCardContext }) {
  const storefront = variant === 'storefront';
  return (
    <div className={storefront ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : 'grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3'}>
      {listings.map((listing, index) => (
        <ListingCard
          key={`${listing.team.slug}/${listing.vehicle.slug}`}
          listing={listing}
          priority={index < 3}
          dates={dates}
          context={variant}
          sizes={storefront ? '(min-width: 1024px) 400px, 448px' : undefined}
        />
      ))}
    </div>
  );
}
