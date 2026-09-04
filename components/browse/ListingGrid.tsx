import type { MarketplaceListing } from '@/domain/booking/publicContracts';
import { ListingCard } from './ListingCard';

/** The grid spine from the mockup: 1 → 2 → 3 columns, inside the shared container. */
export function ListingGrid({ listings, dates }: { listings: MarketplaceListing[]; dates?: { start: string; end: string } }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing, index) => (
        <ListingCard key={`${listing.team.slug}/${listing.vehicle.slug}`} listing={listing} priority={index < 3} dates={dates} />
      ))}
    </div>
  );
}
