'use client';

import { Camera, Check, Clock3, Truck, UserPlus } from 'lucide-react';
import { Money, PrimaryButton } from '../BookingChrome';
import { getCuratedExtras } from '@/domain/booking/service';
import type { BookingCart, ExtraSelection } from '@/domain/booking/types';
import { CheckCircle, RunningTotalCard, ScreenShell, SelectableCard, StepHeader, Sticky } from './shared';
import { recomputeBookingCart } from './state';

const extraIcons = {
  delivery: Truck,
  driver: UserPlus,
  photo: Camera,
  'late-return': Clock3,
} as const;

export function ExtrasStep({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const toggle = (extra: ExtraSelection) => {
    const exists = cart.extras.some((item) => item.id === extra.id);
    setCart(recomputeBookingCart({ ...cart, extras: exists ? cart.extras.filter((item) => item.id !== extra.id) : [...cart.extras, extra] }));
  };
  const extras = getCuratedExtras();
  return (
    <>
      <ScreenShell>
        <StepHeader eyebrow="Step 04" title="Add to your trip" sub="Optional · curated by the operator." />
        <div className="space-y-3">
          {extras.map((extra) => {
            const selected = cart.extras.some((item) => item.id === extra.id);
            const Icon = extraIcons[extra.id as keyof typeof extraIcons] ?? Check;
            return (
              <SelectableCard key={extra.id} selected={selected} onClick={() => toggle(extra)}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${selected ? 'bg-[#C8A664]/15 text-[#C8A664]' : 'bg-[#1E2230] text-[#9BA1B0]'}`}><Icon size={18} strokeWidth={1.6} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium">{extra.name}</span>
                      <span className={`shrink-0 text-[13px] font-medium tabular-nums ${selected ? 'text-[#C8A664]' : 'text-[#9BA1B0]'}`}>{selected ? '+' : ''}<Money cents={extra.priceCents} />{extra.unit === 'day' ? '/day' : ''}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#9BA1B0]">{extra.description}</p>
                  </div>
                  <CheckCircle checked={selected} />
                </div>
              </SelectableCard>
            );
          })}
        </div>
        <button type="button" onClick={next} className="mt-5 w-full text-center text-[10px] uppercase tracking-[0.22em] text-[#5C6272]">Skip — nothing here is required</button>
      </ScreenShell>
      <Sticky>
        {cart.extras.length > 0 && <RunningTotalCard label={`${cart.extras.length} ${cart.extras.length === 1 ? 'extra' : 'extras'} added`} amountCents={cart.totals.extrasSubtotalCents} accent={false} />}
        <PrimaryButton onClick={next}>Continue</PrimaryButton>
      </Sticky>
    </>
  );
}
