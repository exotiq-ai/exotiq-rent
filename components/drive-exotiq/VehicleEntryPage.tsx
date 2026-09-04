import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, CircleDot, Gauge, MapPin, Settings2, ShieldCheck, Zap } from 'lucide-react';
import { browseEnabled } from '@/domain/booking/config';
import { formatRangeLabel } from '@/domain/booking/dates';
import { getPublicVehicleContext } from '@/domain/booking/service';
import { Money, PhoneViewport } from './BookingChrome';
import { VehicleGallery } from './VehicleGallery';
import { SaveButton } from '@/components/renters/SaveButton';

export async function VehicleEntryPage({ operatorSlug, vehicleSlug, dates }: { operatorSlug: string; vehicleSlug: string; dates?: { start: string; end: string } }) {
  const teamSlug = operatorSlug;
  const result = await getPublicVehicleContext(teamSlug, vehicleSlug);
  if (!result) notFound();
  const { team: operator, vehicle } = result;
  // Performance specs only, and only when we actually have them (curated data).
  // The old fallback tiles were Year / Make / Model / Daily rate — every one of
  // which the hero already states: the H1 is "2024 Bugatti Chiron Sport" and the
  // eyebrow is "From $5,200/day". Four tiles of restatement, with the rate
  // formatted as "$5200" against the hero's "$5,200", and `split(' ')` chopping
  // "Chiron Sport" into a big "Chiron" and a small "Sport". Better to show
  // nothing than to pad the page with what the reader just read.
  const specs = vehicle.specs
    ? [
        { label: '0–60 mph', value: vehicle.specs.zeroToSixty, icon: Gauge },
        { label: 'Power', value: vehicle.specs.power, icon: Zap },
        { label: 'Engine', value: vehicle.specs.engine, icon: CircleDot },
        { label: 'Transmission', value: vehicle.specs.transmission, icon: Settings2 },
      ]
    : [];

  // The public RPCs expose no street address, so join only what exists —
  // `{address}, {city}, {state}` with an empty address rendered ", Scottsdale, AZ".
  const pickupParts = [vehicle.pickupLocation.address, vehicle.pickupLocation.city, vehicle.pickupLocation.state]
    .map((part) => part?.trim())
    .filter(Boolean);
  // Dates chosen on a grid ride into the booking flow (MP-10 / T-13).
  const bookHref = dates ? `/${operator.slug}/${vehicle.slug}/book?start=${dates.start}&end=${dates.end}` : `/${operator.slug}/${vehicle.slug}/book`;
  // MP-14: the heart beside the book button, desktop and phone.
  const saveCar = { team_slug: operator.slug, vehicle_slug: vehicle.slug, name: vehicle.name, href: `/${operator.slug}/${vehicle.slug}`, priceCents: vehicle.dailyRateCents, team_name: operator.name };
  const yourDates = dates ? (
    <p className="mb-2 flex items-center justify-between text-[12px] text-[#9BA1B0]">
      <span>Your dates: <span className="text-[#F0F2F5]">{formatRangeLabel(dates.start, dates.end)}</span></span>
      <Link href={`/${operator.slug}?start=${dates.start}&end=${dates.end}`} className="underline decoration-[#2A2E3A] underline-offset-4 hover:text-[#F0F2F5]">Change</Link>
    </p>
  ) : null;
  const desktopNav = (
    <>
      <Link href={`/${operator.slug}`} className="transition hover:text-[#F0F2F5]">{operator.name}</Link>
      {browseEnabled() && <Link href="/browse" className="transition hover:text-[#F0F2F5]">Browse the fleet</Link>}
    </>
  );

  return (
    <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]" closeHref={`/${operator.slug}`} layout="page" desktopNav={desktopNav}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-36 pt-1 [scrollbar-width:none] lg:overflow-visible lg:px-8 lg:pb-20 lg:pt-8">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-12">
          <div className="min-w-0">
            <VehicleGallery
              vehicleName={vehicle.name}
              shortName={vehicle.shortName}
              heroImage={vehicle.heroImage}
              photos={vehicle.photos}
              operatorName={operator.name}
              dailyRateCents={vehicle.dailyRateCents}
              city={operator.city}
              state={operator.state}
            />

            {specs.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 lg:mt-6 lg:grid-cols-4">
              {specs.map((spec) => (
                <div key={spec.label} className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-[14px]">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#848A9A]">{spec.label}</div>
                  <div className="mt-2 flex items-baseline gap-1 text-[#F0F2F5]">
                    <spec.icon className="mr-1 text-[#C8A664]" size={16} />
                    <span className="text-[22px] font-medium leading-none tracking-[-0.02em] tabular-nums">{spec.value.split(' ')[0]}</span>
                    <span className="text-xs text-[#9BA1B0]">{spec.value.split(' ').slice(1).join(' ')}</span>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Phone only — from lg the same facts live in the booking aside. */}
            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 lg:hidden">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><CalendarDays size={16} className="text-[#C8A664]" />Booking preview</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[14px] font-medium leading-none tabular-nums text-[#C8A664] min-[360px]:text-[17px]"><Money cents={vehicle.dailyRateCents} /></div><div className="mt-1.5 text-[#848A9A]">Per day</div></div>
                <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[14px] font-medium leading-none tabular-nums text-[#C8A664] min-[360px]:text-[17px]">{vehicle.minRentalDays}<span className="text-[11px] font-normal text-[#848A9A]"> {vehicle.minRentalDays === 1 ? 'day' : 'days'}</span></div><div className="mt-1.5 text-[#848A9A]">Minimum</div></div>
                <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[14px] font-medium leading-none text-[#C8A664] min-[360px]:text-[17px]">Verified</div><div className="mt-1.5 text-[#848A9A]">Drivers</div></div>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#9BA1B0]">{vehicle.footnote}. Final availability is confirmed at the booking step.</p>
            </div>

            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><MapPin size={16} className="text-[#C8A664]" />Pickup</h2>
              {/* The venue name only renders when it is real. Live reads have none, and
                  a fabricated one repeated the operator and the word "pickup". */}
              {vehicle.pickupLocation.name && <div className="text-sm text-[#F0F2F5]">{vehicle.pickupLocation.name}</div>}
              <div className={`text-xs text-[#9BA1B0]${vehicle.pickupLocation.name ? ' mt-1' : ''}`}>{pickupParts.join(', ')}</div>
              <p className="mt-2 text-[11px] leading-5 text-[#848A9A]">{operator.name} confirms the exact address before pickup.</p>
            </div>

            <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} className="text-[#C8A664]" />How it works</h2>
              {/* Was: "Verify driver and insurance documents" (insurance verification is
                  not built) and "before single Stripe Checkout" (there are two charges,
                  and payment comes AFTER the operator approves — not at booking). */}
              {['Choose your dates and pickup time.', `${operator.name} reviews your request.`, 'We email your payment link once approved.', 'Verify your identity — about two minutes.'].map((item, index) => <div key={item} className="flex gap-3 border-t border-[#2A2E3A] py-3 text-sm text-[#9BA1B0]"><span className="text-[#C8A664]">0{index + 1}</span>{item}</div>)}
            </div>
          </div>

          {/* Desktop booking card: the phone's bottom bar and "Booking preview"
              tiles, as one sticky column beside the gallery. */}
          <aside className="hidden lg:sticky lg:top-6 lg:block">
            <div className="rounded-2xl border border-[#2A2E3A] bg-[#161922] p-6">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#848A9A]">{operator.name}</div>
              <div className="mt-3 flex items-baseline gap-2 text-[#C8A664]">
                <Money cents={vehicle.dailyRateCents} large />
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#848A9A]">per day</span>
              </div>
              <dl className="mt-5 space-y-3 border-t border-[#2A2E3A] pt-5 text-[13px]">
                <div className="flex justify-between gap-4"><dt className="text-[#9BA1B0]">Minimum rental</dt><dd className="text-[#F0F2F5]">{vehicle.minRentalDays} {vehicle.minRentalDays === 1 ? 'day' : 'days'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-[#9BA1B0]">Drivers</dt><dd className="text-[#F0F2F5]">Verified before pickup</dd></div>
                {pickupParts.length > 0 && <div className="flex justify-between gap-4"><dt className="text-[#9BA1B0]">Pickup</dt><dd className="text-right text-[#F0F2F5]">{pickupParts.join(', ')}</dd></div>}
              </dl>
              <div className="mt-6">{yourDates}</div>
              <div className="flex items-stretch gap-2">
                <SaveButton car={saveCar} variant="pill" className="shrink-0" />
                <Link href={bookHref} className="block min-w-0 flex-1 rounded-xl bg-[#C8A664] px-5 py-4 text-center text-[15px] font-medium text-[#1A1308] shadow-[0_14px_34px_rgba(200,166,100,.20)] transition hover:brightness-105">{dates ? 'Book these dates' : 'Select dates'}</Link>
              </div>
              <p className="mt-4 text-[12px] leading-5 text-[#848A9A]">{vehicle.footnote}. Final availability is confirmed at the booking step.</p>
            </div>
          </aside>
        </div>
      </div>
      <div className="absolute bottom-5 left-0 right-0 z-10 border-t border-[#2A2E3A] bg-[#0D0F14] px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)] lg:hidden">
        {yourDates}
        <div className="flex items-stretch gap-2">
          <SaveButton car={saveCar} variant="pill" className="shrink-0" />
          <Link href={bookHref} className="block min-w-0 flex-1 rounded-xl bg-[#C8A664] px-5 py-4 text-center text-[15px] font-medium text-[#1A1308] shadow-[0_14px_34px_rgba(200,166,100,.20)]">{dates ? 'Book these dates' : 'Select dates'}</Link>
        </div>
      </div>
    </PhoneViewport>
  );
}
