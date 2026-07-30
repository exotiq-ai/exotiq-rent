import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarX2, CarFront, FileCheck2, Fuel, Gauge, Phone, ShieldCheck, Truck } from 'lucide-react';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { HTitle, Money, PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { getSiteMode } from '@/domain/booking/config';
import { getPublicTeamStorefront } from '@/domain/booking/service';

type Props = { params: { operatorSlug: string } };

export async function generateMetadata({ params }: Props) {
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow.
  if (getSiteMode() === 'marketplace') notFound();
  const teamSlug = params.operatorSlug;
  const storefront = await getPublicTeamStorefront(teamSlug);
  // notFound() here (before streaming starts) keeps the HTTP status 404;
  // thrown only from the page body it would stream a 200 shell first.
  if (!storefront) notFound();
  return {
    title: `${storefront.team.name} | Drive Exotiq`,
    description: `Book exotic rentals from ${storefront.team.name} in ${storefront.team.city}, ${storefront.team.state}.`,
  };
}

export default async function TeamStorefrontRoute({ params }: Props) {
  const teamSlug = params.operatorSlug;
  const storefront = await getPublicTeamStorefront(teamSlug);
  if (!storefront) notFound();
  const { team, vehicles } = storefront;
  // Live (supabase) teams intentionally expose no phone — the public RPCs
  // withhold operator PII — so `tel:` affordances must not render there or
  // they become dead links (observed live, 2026-07-24). Mock/demo data has one.
  const hasPhone = Boolean(team.phone);

  if (vehicles.length === 0) {
    return (
      <div className={driveFontClassName}>
        <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]">
          <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
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
  const policies = team.policies;
  const policyRows = policies
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
      <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]">
        <section className={`min-h-0 flex-1 overflow-y-auto px-4 pt-2 [scrollbar-width:none] ${hasPhone ? 'pb-32' : 'pb-8'}`}>
          {/* Aman route: the photograph is never degraded to accommodate type, and
              the type is quieter than instinct wants. No scrim, nothing over the
              image, and the operator name sits below in the serif at 22px with the
              location as small tracked caps. The drama is the photograph and the
              whitespace — not the typography.

              Removed the gold "Partner fleet" chip: it badged a commercial
              relationship in the most prominent position on the page, and it was the
              third element competing in a block that should hold one. If partner
              status needs disclosing it belongs in copy, not a gold pill over a car. */}
          <div className="relative -mx-4 mt-[-8px] aspect-[3/2] overflow-hidden bg-[#161922]">
            {heroVehicle.heroImage && <Image src={heroVehicle.heroImage} alt={heroVehicle.name} fill priority sizes="480px" className="object-cover object-[50%_52%]" />}
          </div>
          <div className="mt-4">
            <HTitle className="text-[22px]">{team.name}</HTitle>
            <p className="mt-1.5 text-[11px] uppercase tracking-[0.2em] text-[#848A9A]">{team.city}, {team.state}</p>
          </div>

          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
            <p className="text-[13px] leading-5 text-[#9BA1B0]">{team.about ?? 'A concierge-approved fleet with mobile-first booking, verified drivers, transparent rental charges, and optional Exotiq Protect shown separately.'}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">{vehicles.length}</div><div className="mt-1 text-[#848A9A]">Vehicles</div></div>
              <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">From <Money cents={minRate} /></div><div className="mt-1 text-[#848A9A]">Per day</div></div>
              <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">{minDays}+ day</div><div className="mt-1 text-[#848A9A]">Minimum</div></div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between px-1">
            <h2 className="text-[10px] uppercase tracking-[0.24em] text-[#848A9A]">Available now</h2>
            <div className="text-[11px] text-[#9BA1B0]">{vehicles.length} vehicles</div>
          </div>
          {/* Vehicle cards put NO text over the photo. The previous overlay put the
              price — the topmost line — above where its scrim actually became
              opaque, so gold-on-silver bodywork measured ~1.8:1 contrast and was
              effectively illegible on light cars (Koenigsegg, AMG One). On the
              solid band below it measures ~7:1 on every photo, which is the point:
              a multi-tenant fleet means designing for the worst photo we will ever
              be sent, not the best one we happen to have. */}
          <div className="mt-3 space-y-4">
            {vehicles.map((vehicle) => (
              <Link
                key={vehicle.id}
                href={`/${team.slug}/${vehicle.slug}`}
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
                      sizes="448px"
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

          {policyRows.length > 0 && (
            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium"><FileCheck2 size={16} className="text-[#C8A664]" />Rental policies</div>
              {policyRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3 border-t border-[#2A2E3A] py-3">
                  <row.icon size={15} className="mt-0.5 shrink-0 text-[#848A9A]" />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[#848A9A]">{row.label}</div>
                    <div className="mt-0.5 text-[13px] leading-5 text-[#D7DAE0]">{row.value}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} className="text-[#C8A664]" />Why renters book here</div>
            {['Operator-owned rental charge stays clear.', 'Exotiq Protect is shown separately.', 'Documents are verified before pickup.', 'Concierge handoff details are coordinated before arrival.'].map((item) => <div key={item} className="border-t border-[#2A2E3A] py-3 text-sm text-[#9BA1B0]">{item}</div>)}
          </div>
        </section>
        {hasPhone && (
          <div className="absolute bottom-5 left-0 right-0 z-10 border-t border-[#2A2E3A] bg-[#0D0F14] px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)]">
            <a href={`tel:${team.phone}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#C8A664]/35 bg-[#161922] px-5 py-4 text-sm font-semibold text-[#F0F2F5]"><Phone size={16} />Call {team.name}</a>
          </div>
        )}
      </PhoneViewport>
    </div>
  );
}
