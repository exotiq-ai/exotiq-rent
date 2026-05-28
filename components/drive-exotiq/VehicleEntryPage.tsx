import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, CircleDot, Gauge, MapPin, Settings2, ShieldCheck, Zap } from 'lucide-react';
import { getPublicVehicleContext } from '@/domain/booking/service';
import { HTitle, Money, PhoneViewport } from './BookingChrome';

export async function VehicleEntryPage({ operatorSlug, vehicleSlug }: { operatorSlug: string; vehicleSlug: string }) {
  const teamSlug = operatorSlug;
  const result = await getPublicVehicleContext(teamSlug, vehicleSlug);
  if (!result) notFound();
  const { team: operator, vehicle } = result;
  const specs = [
    { label: '0–60 mph', value: vehicle.specs.zeroToSixty, icon: Gauge },
    { label: 'Power', value: vehicle.specs.power, icon: Zap },
    { label: 'Engine', value: vehicle.specs.engine, icon: CircleDot },
    { label: 'Transmission', value: vehicle.specs.transmission, icon: Settings2 },
  ];

  return (
    <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]">
      <div className="flex-1 overflow-y-auto px-4 pb-36 pt-1 [scrollbar-width:none]">
        <div className="relative -mx-4 mt-[-4px] h-[260px] overflow-hidden">
          <Image src={vehicle.heroImage} alt={vehicle.name} fill sizes="480px" priority className="object-cover object-[50%_52%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0D0F14]/10 to-[#0D0F14]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:4px_4px]" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#C8A664]">{operator.name} · From <Money cents={vehicle.dailyRateCents} />/day</div>
            <HTitle className="mt-2 text-[26px]">{vehicle.name}</HTitle>
            <p className="mt-2 flex items-center gap-2 text-[13px] text-[#D7DAE0]"><MapPin size={14} className="text-[#C8A664]" />{operator.city}, {operator.state} · Concierge-approved rental</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {specs.map((spec) => (
            <div key={spec.label} className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-[14px]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#5C6272]">{spec.label}</div>
              <div className="mt-2 flex items-baseline gap-1 text-[#F0F2F5]">
                <spec.icon className="mr-1 text-[#C8A664]" size={15} />
                <span className="text-[22px] font-medium leading-none tracking-[-0.02em] tabular-nums">{spec.value.split(' ')[0]}</span>
                <span className="text-xs text-[#9BA1B0]">{spec.value.split(' ').slice(1).join(' ')}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><CalendarDays size={16} className="text-[#C8A664]" />Booking preview</div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]"><Money cents={vehicle.dailyRateCents} /></div><div className="mt-1 text-[#5C6272]">Per day</div></div>
            <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">{vehicle.minRentalDays} days</div><div className="mt-1 text-[#5C6272]">Minimum</div></div>
            <div className="rounded-lg bg-[#1E2230] p-3"><div className="text-[#C8A664]">Verified</div><div className="mt-1 text-[#5C6272]">Drivers</div></div>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-[#9BA1B0]">{vehicle.footnote}. Final availability, deposit holds, and payment collection will be handled through the secure booking step.</p>
        </div>

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><MapPin size={16} className="text-[#C8A664]" />Pickup location</div>
          <div className="text-sm text-[#F0F2F5]">{vehicle.pickupLocation.name}</div>
          <div className="mt-1 text-xs text-[#9BA1B0]">{vehicle.pickupLocation.address}, {vehicle.pickupLocation.city}, {vehicle.pickupLocation.state}</div>
        </div>

        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} className="text-[#C8A664]" />Before pickup</div>
          {['Choose dates and pickup time.', 'Verify driver and insurance documents.', 'Review the charge breakdown before single Stripe Checkout.'].map((item, index) => <div key={item} className="flex gap-3 border-t border-[#2A2E3A] py-3 text-sm text-[#9BA1B0]"><span className="text-[#C8A664]">0{index + 1}</span>{item}</div>)}
        </div>
      </div>
      <div className="absolute bottom-5 left-0 right-0 z-10 border-t border-[#2A2E3A] bg-[#0D0F14] px-4 pb-4 pt-3 shadow-[0_-24px_42px_rgba(13,15,20,.96)]">
        <Link href={`/${operator.slug}/${vehicle.slug}/book`} className="block rounded-xl bg-[#C8A664] px-5 py-4 text-center text-[15px] font-medium text-[#1A1308] shadow-[0_14px_34px_rgba(200,166,100,.20)]">Select dates</Link>
      </div>
    </PhoneViewport>
  );
}
