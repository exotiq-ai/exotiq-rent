import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarX2, CarFront, FileCheck2, Fuel, Gauge, MapPin, Phone, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { HTitle, Money, PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { getPublicTeamStorefront } from '@/domain/booking/service';

type Props = { params: { operatorSlug: string } };

export async function generateMetadata({ params }: Props) {
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

  if (vehicles.length === 0) {
    return (
      <div className={driveFontClassName}>
        <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]">
          <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><CarFront size={24} /></div>
            <HTitle className="mt-5 text-[24px]">{team.name}</HTitle>
            <p className="mt-3 text-sm leading-6 text-[#9BA1B0]">No vehicles are listed right now. The fleet is being refreshed — check back soon or call to ask about upcoming availability.</p>
            <a href={`tel:${team.phone}`} className="mt-6 flex items-center gap-2 rounded-xl border border-[#C8A664]/35 bg-[#161922] px-5 py-3 text-sm font-semibold text-[#F0F2F5]"><Phone size={15} />Call {team.name}</a>
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
        <section className="flex-1 overflow-y-auto px-4 pb-32 pt-2 [scrollbar-width:none]">
          <div className="relative -mx-4 mt-[-8px] h-64 overflow-hidden">
            <Image src={heroVehicle.heroImage} alt={heroVehicle.name} fill priority sizes="480px" className="object-cover object-[50%_52%]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-[#0D0F14]/20 to-[#0D0F14]" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#C8A664]/25 bg-[#0D0F14]/70 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#C8A664] backdrop-blur"><Sparkles size={12} /> Partner fleet</div>
              <HTitle className="mt-3 text-[27px]">{team.name}</HTitle>
              <p className="mt-2 flex items-center gap-2 text-sm text-[#D7DAE0]"><MapPin size={15} className="text-[#C8A664]" />{team.city}, {team.state}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
            <p className="text-[13px] leading-5 text-[#9BA1B0]">{team.about ?? 'A concierge-approved fleet with mobile-first booking, verified drivers, transparent rental charges, and optional Exotiq Protect shown separately.'}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">{vehicles.length}</div><div className="mt-1 text-[#5C6272]">Vehicles</div></div>
              <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">From <Money cents={minRate} /></div><div className="mt-1 text-[#5C6272]">Per day</div></div>
              <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">{minDays}+ day</div><div className="mt-1 text-[#5C6272]">Minimum</div></div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between px-1">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#5C6272]">Available now</div>
            <div className="text-[11px] text-[#9BA1B0]">{vehicles.length} vehicles</div>
          </div>
          <div className="mt-3 space-y-3">
            {vehicles.map((vehicle) => (
              <Link key={vehicle.id} href={`/${team.slug}/${vehicle.slug}`} className="block overflow-hidden rounded-xl border border-[#2A2E3A] bg-[#161922] transition hover:border-[#C8A664]/45">
                <div className="relative h-44">
                  <Image src={vehicle.heroImage} alt={vehicle.name} fill sizes="448px" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#161922]" />
                  <div className="absolute left-3 top-3 rounded-full border border-[#C8A664]/25 bg-[#0D0F14]/70 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#C8A664] backdrop-blur">{vehicle.minRentalDays}-day min</div>
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#C8A664]">From <Money cents={vehicle.dailyRateCents} />/day</div>
                      <div className="mt-1 truncate text-base font-medium text-[#F0F2F5]">{vehicle.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[#9BA1B0]"><CarFront size={13} />{vehicle.specs.power} · {vehicle.specs.zeroToSixty} 0–60</div>
                    </div>
                    <span className="rounded-full bg-[#C8A664] px-3 py-1 text-[11px] font-medium text-[#1A1308]">View</span>
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
                  <row.icon size={15} className="mt-0.5 shrink-0 text-[#5C6272]" />
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-[#5C6272]">{row.label}</div>
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
        <div className="absolute bottom-5 left-0 right-0 z-10 border-t border-[#2A2E3A] bg-[#0D0F14] px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)]">
          <a href={`tel:${team.phone}`} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#C8A664]/35 bg-[#161922] px-5 py-4 text-sm font-semibold text-[#F0F2F5]"><Phone size={16} />Call {team.name}</a>
        </div>
      </PhoneViewport>
    </div>
  );
}
