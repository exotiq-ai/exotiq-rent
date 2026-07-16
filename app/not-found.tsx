import Link from 'next/link';
import { CarFront } from 'lucide-react';
import { HTitle, PhoneViewport } from '@/components/drive-exotiq/BookingChrome';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';

export default function NotFound() {
  return (
    <div className={driveFontClassName}>
      <PhoneViewport step={1} stepStyle="numbered" className="font-[var(--font-drive-inter)]">
        <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full border border-[#2A2E3A] bg-[#161922] text-[#C8A664]"><CarFront size={24} /></div>
          <HTitle className="mt-5 text-[24px]">This page took a wrong turn.</HTitle>
          <p className="mt-3 text-sm leading-6 text-[#9BA1B0]">The vehicle, operator, or booking you&apos;re looking for isn&apos;t here. It may have been moved or is no longer listed.</p>
          <Link href="/desert-exotic-rentals" className="mt-6 rounded-xl bg-[#C8A664] px-6 py-3.5 text-sm font-semibold text-[#1A1308]">Browse the fleet</Link>
        </section>
      </PhoneViewport>
    </div>
  );
}
