import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Gauge, Zap, CircleDot, Settings2 } from 'lucide-react';
import { getPublicVehicleContext } from '@/domain/booking/service';
import { HTitle, Money, PhoneViewport } from './BookingChrome';

export async function VehicleEntryPage({ operatorSlug, vehicleSlug }: { operatorSlug: string; vehicleSlug: string }) {
  const teamSlug = operatorSlug;
  const result = await getPublicVehicleContext(teamSlug, vehicleSlug);
  if (!result) notFound();
  const { team: operator, vehicle } = result;
  const specs = [
    { label: '0–60', value: vehicle.specs.zeroToSixty, icon: Gauge },
    { label: 'Power', value: vehicle.specs.power, icon: Zap },
    { label: 'Engine', value: vehicle.specs.engine, icon: CircleDot },
    { label: 'Transmission', value: vehicle.specs.transmission, icon: Settings2 },
  ];

  return (
    <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]">
      <div className="flex-1 overflow-y-auto px-4 pb-28 pt-1 [scrollbar-width:none]">
        <div className="relative -mx-4 mt-[-4px] h-[200px] overflow-hidden">
          <Image src={vehicle.heroImage} alt={vehicle.name} fill sizes="393px" priority className="object-cover object-[50%_52%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0D0F14]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:4px_4px]" />
        </div>
        <div className="flex justify-center py-3">
          <span className="h-1.5 w-[18px] rounded-full bg-[#C8A664]" />
          <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#2A2E3A]" />
          <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#2A2E3A]" />
          <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-[#2A2E3A]" />
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9BA1B0]">
              {operator.name} <span className="text-[#5C6272]">·</span> <span className="text-[#C8A664]">From <Money cents={vehicle.dailyRateCents} />/day</span>
            </div>
            <HTitle className="mt-1 text-[19px]">{vehicle.name}</HTitle>
            <p className="mt-2 text-[13px] leading-5 text-[#9BA1B0]">{operator.city}, {operator.state} · Concierge-approved rental</p>
          </div>
          <span className="mt-1 shrink-0 rounded-md border border-[#C8A664]/30 bg-[#C8A664]/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#C8A664]">Instant</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {specs.map((spec) => (
            <div key={spec.label} className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-[14px]">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[#5C6272]">{spec.label === '0–60' ? '0–60 mph' : spec.label}</div>
              <div className="mt-1 flex items-baseline gap-1 text-[#F0F2F5]">
                <spec.icon className="mr-1 text-[#C8A664]" size={15} />
                <span className="text-[22px] font-medium leading-none tracking-[-0.02em] tabular-nums">{spec.value.split(' ')[0]}</span>
                <span className="text-xs text-[#9BA1B0]">{spec.value.split(' ').slice(1).join(' ')}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center text-[11px] uppercase tracking-[0.10em] text-[#5C6272]">{vehicle.footnote}</div>
      </div>
      <div className="absolute bottom-5 left-0 right-0 z-10 bg-gradient-to-b from-transparent via-[#0D0F14]/80 to-[#0D0F14] px-4 pb-4 pt-8 md:bottom-6">
        <Link href={`/${operator.slug}/${vehicle.slug}/book`} className="block rounded-xl bg-[#C8A664] px-5 py-4 text-center text-[15px] font-medium text-[#1A1308] shadow-[0_14px_34px_rgba(200,166,100,.20)]">Select dates</Link>
      </div>
    </PhoneViewport>
  );
}
