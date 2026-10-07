import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, CircleDot, Gauge, MapPin, Settings2, ShieldCheck, Zap } from 'lucide-react';
import { browseEnabled } from '@/domain/booking/config';
import { formatRangeLabel } from '@/domain/booking/dates';
import { getPublicVehicleContext } from '@/domain/booking/service';
import { Money, PhoneViewport } from './BookingChrome';
import { VehicleGallery } from './VehicleGallery';
import { SaveButton } from '@/components/renters/SaveButton';
import { CookieControls } from '@/components/analytics/CookieControls';
import { ctaClassName, elevatedClassName, eyebrowClassName, stickyBarClassName, stickyBelowBarClassName } from '@/components/browse/tokens';

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
    <p className="mb-2 flex items-center justify-between text-body-sm text-muted">
      <span>Your dates: <span className="text-ink">{formatRangeLabel(dates.start, dates.end)}</span></span>
      <Link href={`/${operator.slug}?start=${dates.start}&end=${dates.end}`} className="underline decoration-line underline-offset-4 hover:text-ink">Change</Link>
    </p>
  ) : null;
  const desktopNav = (
    <>
      <Link href={`/${operator.slug}`} className="transition hover:text-ink">{operator.name}</Link>
      {browseEnabled() && <Link href="/browse" className="transition hover:text-ink">Browse the fleet</Link>}
    </>
  );

  return (
    <PhoneViewport className="font-[var(--font-drive-inter)]" closeHref={`/${operator.slug}`} layout="page" desktopNav={desktopNav}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-1 [scrollbar-width:none] overscroll-y-contain lg:overflow-visible lg:px-8 lg:pb-20 lg:pt-8">
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
                <div key={spec.label} className="rounded-xl border border-line bg-surface p-[14px]">
                  <div className={`${eyebrowClassName} text-faint`}>{spec.label}</div>
                  <div className="mt-2 flex items-baseline gap-1 text-ink">
                    <spec.icon className="mr-1 text-muted" size={16} />
                    <span className="text-title font-medium leading-none tracking-[-0.02em] tabular-nums">{spec.value.split(' ')[0]}</span>
                    <span className="text-label text-muted">{spec.value.split(' ').slice(1).join(' ')}</span>
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Phone only — from lg the same facts live in the booking aside. */}
            <div className="mt-4 border-t border-line pt-4 lg:hidden">
              <h2 className="mb-3 flex items-center gap-2 text-body font-medium"><CalendarDays size={16} className="text-muted" />Booking preview</h2>
              <div className="grid grid-cols-3 divide-x divide-line text-center text-label">
                <div className="px-1"><div className="text-body font-medium leading-none tabular-nums text-ink min-[360px]:text-title-sm min-[360px]:leading-none"><Money cents={vehicle.dailyRateCents} /></div><div className="mt-1.5 text-faint">Per day</div></div>
                <div className="px-1"><div className="text-body font-medium leading-none tabular-nums text-ink min-[360px]:text-title-sm min-[360px]:leading-none">{vehicle.minRentalDays}<span className="text-label font-normal text-faint"> {vehicle.minRentalDays === 1 ? 'day' : 'days'}</span></div><div className="mt-1.5 text-faint">Minimum</div></div>
                <div className="px-1"><div className="text-body font-medium leading-none text-ink min-[360px]:text-title-sm min-[360px]:leading-none">Verified</div><div className="mt-1.5 text-faint">Drivers</div></div>
              </div>
              <p className="mt-3 text-body-sm leading-5 text-muted">{vehicle.footnote}. Final availability is confirmed at the booking step.</p>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 flex items-center gap-2 text-body font-medium"><MapPin size={16} className="text-muted" />Pickup</h2>
              {/* The venue name only renders when it is real. Live reads have none, and
                  a fabricated one repeated the operator and the word "pickup". */}
              {vehicle.pickupLocation.name && <div className="text-body text-ink">{vehicle.pickupLocation.name}</div>}
              <div className={`text-label text-muted${vehicle.pickupLocation.name ? ' mt-1' : ''}`}>{pickupParts.join(', ')}</div>
              <p className="mt-2 text-label leading-5 text-faint">{operator.name} confirms the exact address before pickup.</p>
            </div>

            <div className="mt-4 rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 flex items-center gap-2 text-body font-medium"><ShieldCheck size={16} className="text-muted" />How it works</h2>
              {/* Was: "Verify driver and insurance documents" (insurance verification is
                  not built) and "before single Stripe Checkout" (there are two charges,
                  and payment comes AFTER the operator approves — not at booking). */}
              {['Choose your dates and pickup time.', `${operator.name} reviews your request.`, 'Verify your identity — about two minutes.', 'We email your payment link once approved.'].map((item, index) => <div key={item} className="flex gap-3 border-t border-line py-3 text-body text-muted"><span className="text-faint">0{index + 1}</span>{item}</div>)}
            </div>
          </div>

          {/* Desktop booking card: the phone's bottom bar and "Booking preview"
              tiles, as one sticky column beside the gallery. */}
          <aside className={`hidden lg:block ${stickyBelowBarClassName}`}>
            <div className={`rounded-2xl border border-line bg-surface p-6 ${elevatedClassName}`}>
              <div className={`${eyebrowClassName} text-faint`}>{operator.name}</div>
              <div className="mt-3 flex items-baseline gap-2 text-gold">
                <Money cents={vehicle.dailyRateCents} large />
                <span className={`${eyebrowClassName} text-faint`}>per day</span>
              </div>
              <dl className="mt-5 space-y-3 border-t border-line pt-5 text-body-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Minimum rental</dt><dd className="text-ink">{vehicle.minRentalDays} {vehicle.minRentalDays === 1 ? 'day' : 'days'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Drivers</dt><dd className="text-ink">Verified before pickup</dd></div>
                {pickupParts.length > 0 && <div className="flex justify-between gap-4"><dt className="text-muted">Pickup</dt><dd className="text-right text-ink">{pickupParts.join(', ')}</dd></div>}
              </dl>
              <div className="mt-6">{yourDates}</div>
              <CookieControls viewport="desktop" className="border-t border-line" />
              <div className="flex items-stretch gap-2">
                <SaveButton car={saveCar} variant="pill" className="shrink-0" />
                <Link href={bookHref} className={`block min-w-0 flex-1 rounded-xl px-5 py-4 text-center text-body font-medium ${ctaClassName}`}>{dates ? 'Book these dates' : 'Select dates'}</Link>
              </div>
              <p className="mt-4 text-body-sm leading-5 text-faint">{vehicle.footnote}. Final availability is confirmed at the booking step.</p>
            </div>
          </aside>
        </div>
      </div>
      <div data-chrome="pinned-bar" className={`${stickyBarClassName} lg:hidden`}>
        {yourDates}
        <CookieControls viewport="mobile" />
        <div className="flex items-stretch gap-2">
          <SaveButton car={saveCar} variant="pill" className="shrink-0" />
          <Link href={bookHref} className={`block min-w-0 flex-1 rounded-xl px-5 py-4 text-center text-body font-medium ${ctaClassName}`}>{dates ? 'Book these dates' : 'Select dates'}</Link>
        </div>
      </div>
    </PhoneViewport>
  );
}
