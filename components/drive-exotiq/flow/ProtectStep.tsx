'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Money, PrimaryButton } from '../BookingChrome';
import type { BookingCart, ProtectionTier } from '@/domain/booking/types';
import { ScreenShell, SelectableCard, StepHeader, Sticky } from './shared';
import { recomputeBookingCart } from './state';

export function ProtectStep({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const [declineAcknowledged, setDeclineAcknowledged] = useState(false);
  const setTier = (protection: ProtectionTier) => {
    if (protection !== 'decline') setDeclineAcknowledged(false);
    setCart(recomputeBookingCart({ ...cart, protection }));
  };
  const canContinue = cart.protection !== 'decline' || declineAcknowledged;
  const tiers = [
    { id: 'premium' as const, name: 'Premium', price: 8900, detail: '$0 deductible. Collision, theft, liability up to $250K. Roadside included.', badge: 'Recommended' },
    { id: 'standard' as const, name: 'Standard', price: 5900, detail: '$2,500 deductible. Collision and theft up to $150K.', badge: '' },
  ];
  return (
    <ScreenShell>
      <StepHeader eyebrow="Step 05" title="Exotiq Protect" sub="Drive with confidence. No hidden fees." />
      <div className="space-y-3">
        {tiers.map((tier) => (
          <SelectableCard key={tier.id} selected={cart.protection === tier.id} onClick={() => setTier(tier.id)}>
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-[#C8A664]" />
              <div className="flex-1">
                <div className="flex justify-between"><span className="text-sm font-medium">{tier.name}</span><span><Money cents={tier.price} />/day</span></div>
                {tier.badge && <span className="mt-2 inline-block rounded-full bg-[#C8A664]/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#C8A664]">{tier.badge}</span>}
                <p className="mt-2 text-xs leading-5 text-[#9BA1B0]">{tier.detail}</p>
              </div>
            </div>
          </SelectableCard>
        ))}
        <SelectableCard selected={cart.protection === 'decline'} warning dashed onClick={() => setTier('decline')}>
          <div className="flex justify-between gap-4"><div><div className="text-sm font-medium text-[#FFB84D]">Self-cover · decline protection</div><p className="mt-2 text-xs leading-5 text-[#9BA1B0]">You accept full financial responsibility. A $5,000 authorization hold is required later.</p></div><span className="text-sm">$0</span></div>
        </SelectableCard>
      </div>
      {cart.protection === 'decline' && (
        <label className="mt-4 flex gap-3 rounded-xl border border-[#FFB84D]/45 bg-[#FFB84D]/10 p-4 text-left text-[12px] leading-5 text-[#F0F2F5]">
          <input type="checkbox" checked={declineAcknowledged} onChange={(event) => setDeclineAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 accent-[#FFB84D]" />
          <span>I understand I am declining Exotiq Protect and may be responsible for damage, theft, loss of use, and a later authorization hold.</span>
        </label>
      )}
      <Sticky><PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton></Sticky>
    </ScreenShell>
  );
}
