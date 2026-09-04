import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarX2, CarFront, FileCheck2, Fuel, Gauge, Phone, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { HTitle, Money, PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { FilterBar } from '@/components/browse/FilterBar';
import { browseEnabled, getSiteMode } from '@/domain/booking/config';
import { formatRangeLabel, formatShortDate } from '@/domain/booking/dates';
import { applyMarketplaceQuery, computeFacets, excludeBusy, filterListings } from '@/domain/booking/marketplaceCore';
import { parseMarketplaceQuery, toMarketplaceSearchParams, type SearchParamsLike } from '@/domain/booking/marketplaceQuery';
import { getFleetBusy, getPublicTeamStorefront } from '@/domain/booking/service';
import type { MarketplaceListing, PublicTeamStorefront } from '@/domain/booking/publicContracts';

type Props = { params: { operatorSlug: string }; searchParams?: SearchParamsLike };
type Team = PublicTeamStorefront['team'];
type PolicyRow = { icon: LucideIcon; label: string; value: string };

export async function generateMetadata({ params, searchParams }: Props) {
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow.
  if (getSiteMode() === 'marketplace') notFound();
  const teamSlug = params.operatorSlug;
  const storefront = await getPublicTeamStorefront(teamSlug);
  // notFound() here (before streaming starts) keeps the HTTP status 404;
  // thrown only from the page body it would stream a 200 shell first.
  if (!storefront) notFound();
  // Filtered views (MP-8) are permutations of one page: canonical to the bare
  // storefront and out of the index, follow on, so facets cannot multiply it.
  const filtered = toMarketplaceSearchParams(parseMarketplaceQuery(searchParams ?? {})).toString() !== '';
  return {
    title: `${storefront.team.name} | Drive Exotiq`,
    description: `Book exotic rentals from ${storefront.team.name} in ${storefront.team.city}, ${storefront.team.state}.`,
    alternates: { canonical: `/${storefront.team.slug}` },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

// The three side cards render twice on the storefront — in the phone column
// (hidden from lg) and in the desktop aside (hidden below lg) — so the mobile
// DOM order stays exactly what shipped while desktop gets a real two-column
// layout. Text only, no images, so the duplication costs nothing measurable.
function AboutCard({ team, count, minRate, minDays, className = '' }: { team: Team; count: number; minRate: number; minDays: number; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 ${className}`}>
      <p className="text-[13px] leading-5 text-[#9BA1B0]">{team.about ?? 'A concierge-approved fleet with mobile-first booking, verified drivers, transparent rental charges, and optional Exotiq Protect shown separately.'}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">{count}</div><div className="mt-1 text-[#848A9A]">Vehicles</div></div>
        <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">From <Money cents={minRate} /></div><div className="mt-1 text-[#848A9A]">Per day</div></div>
        <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">{minDays}+ day</div><div className="mt-1 text-[#848A9A]">Minimum</div></div>
      </div>
    </div>
  );
}

function PolicyCard({ rows, className = '' }: { rows: PolicyRow[]; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileCheck2 size={16} className="text-[#C8A664]" />Rental policies</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-3 border-t border-[#2A2E3A] py-3">
          <row.icon size={15} className="mt-0.5 shrink-0 text-[#848A9A]" />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.16em] text-[#848A9A]">{row.label}</div>
            <div className="mt-0.5 text-[13px] leading-5 text-[#D7DAE0]">{row.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function WhyCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} className="text-[#C8A664]" />Why renters book here</div>
      {['Operator-owned rental charge stays clear.', 'Exotiq Protect is shown separately.', 'Documents are verified before pickup.', 'Concierge handoff details are coordinated before arrival.'].map((item) => <div key={item} className="border-t border-[#2A2E3A] py-3 text-sm text-[#9BA1B0]">{item}</div>)}
    </div>
  );
}

function CallLink({ team }: { team: Team }) {
  return (
    <a href={`tel:${team.phone}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#C8A664]/35 bg-[#161922] px-5 py-4 text-sm font-semibold text-[#F0F2F5]"><Phone size={16} />Call {team.name}</a>
  );
}

export default async function TeamStorefrontRoute({ params, searchParams }: Props) {
  const teamSlug = params.operatorSlug;
  const storefront = await getPublicTeamStorefront(teamSlug);
  if (!storefront) notFound();
  const { team, vehicles } = storefront;
  // Live (supabase) teams intentionally expose no phone — the public RPCs
  // withhold operator PII — so `tel:` affordances must not render there or
  // they become dead links (observed live, 2026-07-24). Mock/demo data has one.
  const hasPhone = Boolean(team.phone);
  // Desktop site bar: the only cross-tenant link, and only where /browse exists.
  const desktopNav = browseEnabled() ? <Link href="/browse" className="transition hover:text-[#F0F2F5]">Browse the fleet</Link> : undefined;

  if (vehicles.length === 0) {
    return (
      <div className={driveFontClassName}>
        <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]" closeHref={`/${team.slug}`} layout="page" desktopNav={desktopNav}>
          <section className="flex flex-1 flex-col items-center justify-center px-6 text-center lg:py-32">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><CarFront size={24} /></div>
            <HTitle className="mt-5 text-[24px]">{team.name}</HTitle>
            <p className="mt-3 text-sm leading-6 text-[#9BA1B0]">No vehicles are listed right now. The fleet is being refreshed — check back soon{hasPhone ? ' or call to ask about upcoming availability' : ''}.</p>
            {hasPhone && (
              <a href={`tel:${team.phone}`} className="mt-6 flex items-center gap-2 rounded-xl border border-[#C8A664]/35 bg-[#161922] px-5 py-3 text-sm font-semibold text-[#F0F2F5]"><Phone size={15} />Call {team.name}</a>
            )}
          </section>
        </PhoneViewport>
      </div>
    );
  }

  const heroVehicle = vehicles[0];
  const minRate = Math.min(...vehicles.map((vehicle) => vehicle.dailyRateCents));
  const minDays = Math.min(...vehicles.map((vehicle) => vehicle.minRentalDays));
  // Storefront filters (MP-8): the same query language and core as /browse,
  // over this tenant's fleet only. Facets come from the whole fleet so a chip
  // always names something that exists here; paging is off — a storefront
  // shows every matching car. City is a cross-tenant facet, meaningless on
  // one storefront, so it is ignored rather than allowed to empty the grid.
  // 'featured' keeps the fleet RPC's own order (price desc, its tie order):
  // the default view must look exactly as it did before filters existed.
  const listings: MarketplaceListing[] = vehicles.map((vehicle) => ({ team, vehicle, photoCount: Math.max(1, vehicle.photos.length) }));
  const query = { ...parseMarketplaceQuery(searchParams ?? {}), city: undefined, state: undefined };
  const facets = computeFacets(listings);
  // Availability (MP-10): one uncached busy read for this storefront; on
  // failure show every car and say so rather than pretend they are all free.
  const window = query.start && query.end ? { start: query.start, end: query.end } : undefined;
  const availability = window ? { ...window, ...(await getFleetBusy(window, team.slug)) } : undefined;
  const matched =
    query.sort === 'featured'
      ? filterListings(listings, query)
      : applyMarketplaceQuery(listings, { ...query, limit: Number.MAX_SAFE_INTEGER, offset: 0 }).listings;
  const shown = availability ? excludeBusy(matched, availability.busy) : matched;
  // The dates-aware zero state only when the dates are the reason — with a
  // make or price chip set too, the plain "loosen a filter" copy is truer.
  const emptyByDates = Boolean(availability?.checked) && query.makes.length === 0 && query.types.length === 0 && query.minDailyRateCents === undefined && query.maxDailyRateCents === undefined;
  const carHref = (slug: string) => (window ? `/${team.slug}/${slug}?start=${window.start}&end=${window.end}` : `/${team.slug}/${slug}`);
  const filterKey = toMarketplaceSearchParams(query).toString();
  const policies = team.policies;
  const policyRows: PolicyRow[] = policies
    ? [
        { icon: FileCheck2, label: 'Minimum driver age', value: `${policies.minimumDriverAge}+ with valid license & insurance` },
        { icon: CalendarX2, label: 'Cancellation', value: `Free up to ${policies.freeCancellationHours}h before pickup` },
        { icon: Gauge, label: 'Mileage', value: policies.milesIncludedPerDay === 'unlimited' ? 'Unlimited miles included' : `${policies.milesIncludedPerDay} miles/day included` },
        { icon: Fuel, label: 'Fuel', value: policies.fuelPolicy },
        ...(policies.deliveryAvailable ? [{ icon: Truck, label: 'Delivery', value: policies.deliveryNote ?? 'Delivery available on request' }] : []),
      ]
    : [];

  return (
    <div className={driveFontClassName}>
      <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]" closeHref={`/${team.slug}`} layout="page" desktopNav={desktopNav}>
        {/* From lg the frame no longer scrolls internally (see PhoneViewport
            'page'), so this section becomes ordinary page flow and the aside
            below can stick to the viewport. */}
        <section className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 [scrollbar-width:none] ${hasPhone ? 'pb-32' : 'pb-8'} lg:overflow-visible lg:px-8 lg:pb-20 lg:pt-8`}>
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-12">
            <div className="min-w-0">
              {/* Aman route: the photograph is never degraded to accommodate type, and
                  the type is quieter than instinct wants. No scrim, nothing over the
                  image, and the operator name sits below in the serif at 22px with the
                  location as small tracked caps. The drama is the photograph and the
                  whitespace — not the typography.

                  Removed the gold "Partner fleet" chip: it badged a commercial
                  relationship in the most prominent position on the page, and it was the
                  third element competing in a block that should hold one. If partner
                  status needs disclosing it belongs in copy, not a gold pill over a car. */}
              <div className="relative -mx-4 mt-[-8px] aspect-[3/2] overflow-hidden bg-[#161922] lg:mx-0 lg:mt-0 lg:aspect-[21/9] lg:rounded-2xl">
                {heroVehicle.heroImage && <Image src={heroVehicle.heroImage} alt={heroVehicle.name} fill priority sizes="(min-width: 1024px) 840px, 480px" className="object-cover object-[50%_52%]" />}
              </div>
              <div className="mt-4 lg:mt-6">
                <HTitle className="text-[22px] lg:text-[34px]">{team.name}</HTitle>
                <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-[#848A9A]">{team.city}, {team.state}</p>
              </div>

              <AboutCard team={team} count={vehicles.length} minRate={minRate} minDays={minDays} className="mt-4 lg:hidden" />

              <div className="mt-5 px-1 lg:mt-8">
                <FilterBar key={filterKey} facets={facets} query={query} action={`/${team.slug}`} />
              </div>
              {availability && (
                <p className={`mt-4 rounded-lg border px-3.5 py-2.5 text-[12px] ${availability.checked ? 'border-[#2A2E3A] text-[#9BA1B0]' : 'border-[#FFB84D]/45 bg-[#FFB84D]/10 text-[#F0F2F5]'}`}>
                  {availability.checked
                    ? <>Showing cars available <span className="text-[#F0F2F5]" aria-label={`${formatShortDate(availability.start)} to ${formatShortDate(availability.end)}`}>{formatRangeLabel(availability.start, availability.end)}</span>. We&apos;ll confirm your exact dates when you book.</>
                    : <>We couldn&apos;t check availability for {formatRangeLabel(availability.start, availability.end)} just now, so every car is shown. We&apos;ll confirm your exact dates when you book.</>}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between px-1">
                <h2 className="text-[10px] uppercase tracking-[0.24em] text-[#848A9A]">{availability ? (availability.checked ? 'Available for your dates' : 'All vehicles') : 'Available now'}</h2>
                <div className="text-[11px] text-[#9BA1B0]">
                  {shown.length === vehicles.length ? `${vehicles.length} vehicles` : `${shown.length} of ${vehicles.length} vehicles`}
                </div>
              </div>
              {/* Vehicle cards put NO text over the photo. The previous overlay put the
                  price — the topmost line — above where its scrim actually became
                  opaque, so gold-on-silver bodywork measured ~1.8:1 contrast and was
                  effectively illegible on light cars (Koenigsegg, AMG One). On the
                  solid band below it measures ~7:1 on every photo, which is the point:
                  a multi-tenant fleet means designing for the worst photo we will ever
                  be sent, not the best one we happen to have. */}
              {shown.length === 0 ? (
                <div className="mt-3 flex flex-col items-center rounded-2xl border border-dashed border-[#2A2E3A] px-6 py-12 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><CarFront size={22} /></div>
                  <h3 className="mt-4 text-[20px] text-[#F0F2F5]" style={{ fontFamily: 'var(--font-drive-newsreader), Georgia, serif', fontWeight: 500 }}>
                    {emptyByDates && availability ? `Nothing is free ${formatRangeLabel(availability.start, availability.end)}.` : 'No cars match those filters.'}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#9BA1B0]">
                    {emptyByDates ? `Try different dates, or see all ${vehicles.length} cars ${team.name} lists.` : `${team.name} lists ${vehicles.length} cars right now. Loosen a filter, or see them all.`}
                  </p>
                  <Link href={`/${team.slug}`} className="mt-5 rounded-xl border border-[#C8A664]/40 px-5 py-3 text-sm font-semibold text-[#C8A664]">{emptyByDates ? `See all ${vehicles.length} (clears dates)` : `Show all ${vehicles.length}`}</Link>
                </div>
              ) : (
              <div className="mt-3 space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
                {shown.map(({ vehicle }) => (
                  <Link
                    key={vehicle.id}
                    href={carHref(vehicle.slug)}
                    className="group block overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922] transition-colors duration-300 hover:border-[#C8A664]/45"
                  >
                    {/* 4:3 and unobstructed — the car is the product, and the old
                        scrim was eating the stance and wheels. */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#1E2230]">
                      {vehicle.heroImage && (
                        <Image
                          src={vehicle.heroImage}
                          alt={vehicle.name}
                          fill
                          sizes="(min-width: 1024px) 400px, 448px"
                          className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.03]"
                        />
                      )}
                      {/* The one thing that may sit on the photo: a pill carries its own
                          backdrop, so its contrast holds regardless of what is behind it. */}
                      <div className="absolute left-3 top-3 rounded-full border border-[#C8A664]/25 bg-[#0D0F14]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C8A664] backdrop-blur">
                        {vehicle.minRentalDays}-day min
                      </div>
                    </div>
                    <div className="border-t border-[#2A2E3A] px-4 pb-4 pt-3.5">
                      <div className="flex items-baseline justify-between gap-4">
                        {/* h3 under the team h1 and the section h2 — real document
                            structure for screen readers and search engines. Serif to
                            match the display face; the vehicle name is the headline. */}
                        <h3
                          className="min-w-0 truncate text-[17px] leading-[1.2] text-[#F0F2F5]"
                          style={{ fontFamily: 'var(--font-drive-newsreader), Georgia, serif', fontWeight: 500, letterSpacing: '-0.014em' }}
                        >
                          {vehicle.name}
                        </h3>
                        <div className="shrink-0 text-[17px] leading-[1.2] text-[#C8A664]">
                          <Money cents={vehicle.dailyRateCents} />
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-4">
                        <div className="min-w-0 truncate text-[12px] text-[#9BA1B0]">
                          {vehicle.specs ? `${vehicle.specs.power} · ${vehicle.specs.zeroToSixty} 0–60` : `${vehicle.year} ${vehicle.make}`.trim()}
                        </div>
                        {/* Unit split off the number so the figure reads as the figure. */}
                        <div className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-[#5C6272]">per day</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              )}

              {policyRows.length > 0 && <PolicyCard rows={policyRows} className="mt-4 lg:hidden" />}
              <WhyCard className="mt-4 lg:hidden" />
            </div>

            <aside className="hidden lg:sticky lg:top-6 lg:block lg:space-y-4">
              <AboutCard team={team} count={vehicles.length} minRate={minRate} minDays={minDays} />
              {hasPhone && <CallLink team={team} />}
              {policyRows.length > 0 && <PolicyCard rows={policyRows} />}
              <WhyCard />
            </aside>
          </div>
        </section>
        {hasPhone && (
          <div className="absolute bottom-5 left-0 right-0 z-10 border-t border-[#2A2E3A] bg-[#0D0F14] px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)] lg:hidden">
            <CallLink team={team} />
          </div>
        )}
      </PhoneViewport>
    </div>
  );
}
