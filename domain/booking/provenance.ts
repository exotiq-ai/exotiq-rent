/**
 * The storefront card's meta line (MP-12): what the headline does not already
 * say. A name like "Audi S8 Plus" gets the year alone; "2017 Audi S8 Plus"
 * (the adapter's fallback for a nameless row, or a tenant who typed the year)
 * gets nothing rather than "2017 Audi" repeated beneath it.
 */
export function storefrontProvenance(name: string, year: number | null | undefined, make: string | null | undefined): string {
  const bare = name.replace(/^\s*(19|20)\d{2}\s+/, '');
  const nameHasYear = bare !== name;
  const makeLower = (make ?? '').trim().toLowerCase();
  const nameStartsWithMake = makeLower.length > 0 && bare.trim().toLowerCase().startsWith(makeLower);
  return [nameHasYear ? null : year || null, nameStartsWithMake ? null : (make ?? '').trim() || null].filter(Boolean).join(' ');
}
