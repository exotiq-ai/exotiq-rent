'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Check, ChevronRight, CreditCard, FileText, MapPin,
  Phone, Plus, ShieldCheck, Sparkles, Upload, UserRound, WalletCards,
} from 'lucide-react';
import { BookingChrome, HTitle, Money, PhoneViewport, PrimaryButton } from './BookingChrome';
import { createInitialCart, curatedExtras } from '@/domain/booking/mockData';
import { calculateBookingTotals, formatMoney } from '@/domain/booking/totals';
import type { BookingCart, ExtraSelection, Operator, ProtectionTier, Vehicle, VerificationStatus } from '@/domain/booking/types';

const taxRate = 0.078;

function recompute(cart: BookingCart): BookingCart {
  return {
    ...cart,
    totals: calculateBookingTotals({
      dailyRateCents: cart.vehicle.dailyRateCents,
      startDate: cart.dates.start,
      endDate: cart.dates.end,
      extras: cart.extras,
      protection: cart.protection,
      operatorTaxRate: taxRate,
    }),
  };
}

function Card({ children, selected = false, warning = false, dashed = false, onClick }: { children: React.ReactNode; selected?: boolean; warning?: boolean; dashed?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl p-4 text-left transition"
      style={{
        backgroundColor: selected ? (warning ? 'rgba(255,184,77,0.08)' : 'rgba(200,166,100,0.10)') : '#161922',
        border: `${selected ? '1.5px' : '1px'} ${dashed ? 'dashed' : 'solid'} ${selected ? (warning ? '#FFB84D' : '#C8A664') : '#2A2E3A'}`,
        boxShadow: selected && !warning ? '0 0 0 4px rgba(200,166,100,0.08)' : 'none',
      }}
    >
      {children}
    </button>
  );
}

function StepHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#5C6272]">{eyebrow}</div>
      <HTitle className="mt-2">{title}</HTitle>
      {sub && <p className="mt-2 text-[13px] leading-5 text-[#9BA1B0]">{sub}</p>}
    </div>
  );
}

function DatesScreen({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const selected = [14, 15, 16, 17];
  return (
    <ScreenShell>
      <StepHeader eyebrow="Step 02" title="When are you driving?" sub={`${cart.vehicle.minRentalDays}-day minimum · from ${formatMoney(cart.vehicle.dailyRateCents)}/day`} />
      <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium">June 2026</span>
          <CalendarDays size={18} className="text-[#C8A664]" />
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-[0.16em] text-[#5C6272]">
          {['S','M','T','W','T','F','S'].map((d, index) => <span key={`${d}-${index}`}>{d}</span>)}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-0 text-center text-sm">
          <span />
          {days.map((day) => {
            const isEnd = day === 14 || day === 17;
            const inRange = selected.includes(day);
            return (
              <button key={day} type="button" className="relative flex h-10 items-center justify-center">
                {inRange && !isEnd && <span className="absolute inset-y-[5px] left-0 right-0 bg-[#C8A664]/10" />}
                {isEnd && <span className="absolute h-8 w-8 rounded-full bg-[#C8A664]" />}
                <span className="relative z-10" style={{ color: isEnd ? '#1A1308' : inRange ? '#F0F2F5' : '#9BA1B0' }}>{day}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
        <div className="flex justify-between text-sm"><span className="text-[#9BA1B0]">Jun 14–17 · {cart.totals.days} days</span><span><Money cents={cart.vehicle.dailyRateCents} />/day</span></div>
        <div className="mt-3 flex justify-between border-t border-[#2A2E3A] pt-3"><span className="text-[#9BA1B0]">Rental estimate</span><Money cents={cart.totals.rentalSubtotalCents} /></div>
      </div>
      <label className="mt-4 block text-xs uppercase tracking-[0.22em] text-[#5C6272]">Pickup time</label>
      <select value={cart.pickupTime} onChange={(event) => setCart(recompute({ ...cart, pickupTime: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#2A2E3A] bg-[#161922] px-4 py-3 text-sm text-[#F0F2F5]">
        <option>10:00 AM</option><option>12:00 PM</option><option>2:00 PM</option><option>4:00 PM</option>
      </select>
      <Sticky><PrimaryButton onClick={next}>Continue</PrimaryButton></Sticky>
    </ScreenShell>
  );
}

function DriverScreen({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const setDoc = (kind: 'license' | 'insurance', status: VerificationStatus) => setCart({ ...cart, driver: { ...cart.driver, [kind]: { fileId: `mock-${kind}`, status, thumbnailUrl: '/images/app/app-detail.png' } } });
  const canContinue = cart.driver.license.status === 'verified' && cart.driver.insurance.status === 'verified';
  return (
    <ScreenShell>
      <StepHeader eyebrow="Step 03" title="Who's driving?" sub="We verify ahead of pickup · 60 seconds." />
      <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-4">
        {[['Name', cart.driver.name], ['DOB', 'Jun 14, 1985'], ['Phone', cart.driver.phone]].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-[#2A2E3A] py-3 last:border-0">
            <span className="text-xs uppercase tracking-[0.18em] text-[#5C6272]">{label}</span><span className="flex items-center gap-2 text-sm"><Check size={14} className="text-[#C8A664]" />{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 text-[10px] uppercase tracking-[0.24em] text-[#5C6272]">Documents</div>
      <UploadCard title="Driver's license" status={cart.driver.license.status} onClick={() => setDoc('license', 'verified')} />
      <UploadCard title="Proof of insurance" status={cart.driver.insurance.status} onClick={() => setDoc('insurance', 'verified')} />
      <p className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-[12px] leading-5 text-[#9BA1B0]">We verify ahead of pickup. Documents are encrypted and deleted within 30 days of return.</p>
      <Sticky><PrimaryButton onClick={next} disabled={!canContinue}>Continue</PrimaryButton></Sticky>
    </ScreenShell>
  );
}

function UploadCard({ title, status, onClick }: { title: string; status: VerificationStatus; onClick: () => void }) {
  const verified = status === 'verified';
  return (
    <button type="button" onClick={onClick} className="mt-3 flex w-full items-center gap-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-left">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C8A664]/10 text-[#C8A664]">{verified ? <Check /> : <Upload />}</div>
      <div className="flex-1"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs text-[#9BA1B0]">{verified ? 'Verified' : 'Tap to upload'}</div></div>
      <ChevronRight size={16} className="text-[#5C6272]" />
    </button>
  );
}

function ExtrasScreen({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const toggle = (extra: ExtraSelection) => {
    const exists = cart.extras.some((item) => item.id === extra.id);
    setCart(recompute({ ...cart, extras: exists ? cart.extras.filter((item) => item.id !== extra.id) : [...cart.extras, extra] }));
  };
  return (
    <ScreenShell>
      <StepHeader eyebrow="Step 04" title="Add to your trip" sub="Optional · curated by the operator." />
      <div className="space-y-3">
        {curatedExtras.map((extra) => {
          const selected = cart.extras.some((item) => item.id === extra.id);
          return <Card key={extra.id} selected={selected} onClick={() => toggle(extra)}><div className="flex items-start gap-3"><div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><Plus size={16} /></div><div className="flex-1"><div className="flex justify-between gap-3"><span className="text-sm font-medium">{extra.name}</span><span className="text-sm"><Money cents={extra.priceCents} />{extra.unit === 'day' ? '/day' : ''}</span></div><p className="mt-1 text-xs leading-5 text-[#9BA1B0]">{extra.description}</p></div></div></Card>;
        })}
      </div>
      {cart.extras.length > 0 && <div className="mt-4 rounded-xl border border-[#C8A664]/30 bg-[#C8A664]/10 p-4 text-sm"><div className="flex justify-between"><span>{cart.extras.length} selected</span><span>+<Money cents={cart.totals.extrasSubtotalCents} /></span></div></div>}
      <button type="button" onClick={next} className="mt-5 w-full text-center text-xs text-[#9BA1B0]">Skip — nothing here is required</button>
      <Sticky><PrimaryButton onClick={next}>Continue</PrimaryButton></Sticky>
    </ScreenShell>
  );
}

function ProtectScreen({ cart, setCart, next }: { cart: BookingCart; setCart: (cart: BookingCart) => void; next: () => void }) {
  const [declineAcknowledged, setDeclineAcknowledged] = useState(false);
  const setTier = (protection: ProtectionTier) => {
    if (protection !== 'decline') setDeclineAcknowledged(false);
    setCart(recompute({ ...cart, protection }));
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
        {tiers.map((tier) => <Card key={tier.id} selected={cart.protection === tier.id} onClick={() => setTier(tier.id)}><div className="flex items-start gap-3"><ShieldCheck className="text-[#C8A664]" /><div className="flex-1"><div className="flex justify-between"><span className="text-sm font-medium">{tier.name}</span><span><Money cents={tier.price} />/day</span></div>{tier.badge && <span className="mt-2 inline-block rounded-full bg-[#C8A664]/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-[#C8A664]">{tier.badge}</span>}<p className="mt-2 text-xs leading-5 text-[#9BA1B0]">{tier.detail}</p></div></div></Card>)}
        <Card selected={cart.protection === 'decline'} warning dashed onClick={() => setTier('decline')}><div className="flex justify-between gap-4"><div><div className="text-sm font-medium text-[#FFB84D]">Self-cover · decline protection</div><p className="mt-2 text-xs leading-5 text-[#9BA1B0]">You accept full financial responsibility. A $5,000 authorization hold is required later.</p></div><span className="text-sm">$0</span></div></Card>
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

function ReviewScreen({ cart, goTo, next }: { cart: BookingCart; goTo: (step: number) => void; next: () => void }) {
  return (
    <ScreenShell>
      <StepHeader eyebrow="Step 06" title="Review the split." sub="Your rental and Exotiq Protect are shown separately for clarity." />
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#2A2E3A] bg-[#161922] p-3 text-center text-[11px]"><div><span className="block text-[#5C6272]">Dates</span>Jun 14–17</div><div><span className="block text-[#5C6272]">Pickup</span>{cart.pickupTime}</div><div><span className="block text-[#5C6272]">Location</span>{cart.operator.city}</div></div>
      <Breakdown title="Operator" note={`Charge from ${cart.operator.name}`} rows={[['Rental', `${cart.totals.days} × ${formatMoney(cart.vehicle.dailyRateCents)}`, cart.totals.rentalSubtotalCents, () => goTo(1)], ['Extras', `${cart.extras.length} selected`, cart.totals.extrasSubtotalCents, () => goTo(3)], ['Taxes & fees', 'Operator tax estimate', cart.totals.operatorTaxesCents]]} total={cart.totals.operatorTotalCents} />
      <Breakdown title="Protection" note="Charge from Exotiq" rows={[['Exotiq Protect', cart.protection === 'decline' ? 'Declined — hold required later' : `${cart.protection} · ${cart.totals.days} days`, cart.totals.protectionTotalCents, () => goTo(4)]]} total={cart.totals.protectionTotalCents} />
      <div className="mt-4 rounded-xl border border-[#C8A664] bg-[#C8A664]/10 p-4"><div className="flex items-center justify-between"><span className="text-sm text-[#9BA1B0]">Total due</span><Money cents={cart.totals.grandTotalCents} large /></div></div>
      <Sticky><PrimaryButton onClick={next}>Proceed to payment</PrimaryButton></Sticky>
    </ScreenShell>
  );
}

function Breakdown({ title, note, rows, total }: { title: string; note: string; rows: [string, string, number, (() => void)?][]; total: number }) {
  return <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="mb-3 flex justify-between"><div><div className="text-sm font-medium">{title}</div><div className="mt-1 text-[11px] text-[#C8A664]">{note}</div></div><FileText size={18} className="text-[#5C6272]" /></div>{rows.map(([label, detail, amount, action]) => <button key={label} type="button" onClick={action} className="flex w-full justify-between border-t border-[#2A2E3A] py-3 text-left text-sm"><span><span className="block">{label}</span><span className="text-xs text-[#9BA1B0]">{detail}</span></span><Money cents={amount} /></button>)}<div className="flex justify-between border-t border-[#2A2E3A] pt-3 text-sm font-medium"><span>Total</span><Money cents={total} /></div></div>;
}

function PayScreen({ cart, onPay }: { cart: BookingCart; onPay: () => void }) {
  return (
    <ScreenShell>
      <StepHeader eyebrow="Step 07" title="Pay securely" sub="Mocked payment today · Stripe boundary next." />
      <div className="rounded-xl border border-[#C8A664] bg-[#C8A664]/10 p-4"><div className="text-xs uppercase tracking-[0.22em] text-[#5C6272]">Total due today</div><div className="mt-2"><Money cents={cart.totals.grandTotalCents} large /></div></div>
      <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm">
        <div className="flex justify-between"><span className="text-[#9BA1B0]">Operator charge</span><Money cents={cart.totals.operatorTotalCents} /></div>
        <div className="mt-3 flex justify-between border-t border-[#2A2E3A] pt-3"><span className="text-[#9BA1B0]">Exotiq Protect charge</span><Money cents={cart.totals.protectionTotalCents} /></div>
      </div>
      <button type="button" onClick={onPay} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 text-sm font-semibold text-white"><WalletCards size={18} /> Apple Pay mock</button>
      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.22em] text-[#5C6272]"><span className="h-px flex-1 bg-[#2A2E3A]" />Tokenized card mock<span className="h-px flex-1 bg-[#2A2E3A]" /></div>
      <div className="rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#C8A664]/10 text-[#C8A664]"><CreditCard size={18} /></div><div className="flex-1"><div className="text-sm font-medium">Mock payment method</div><div className="mt-1 text-xs text-[#9BA1B0]">Tokenized test method ready for future Stripe Elements integration.</div></div><Check size={16} className="text-[#C8A664]" /></div></div>
      <p className="mt-4 text-center text-xs text-[#5C6272]">No raw card data is collected in this scaffold.</p>
      <Sticky><PrimaryButton onClick={onPay}>Pay {formatMoney(cart.totals.grandTotalCents)}</PrimaryButton></Sticky>
    </ScreenShell>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) { return <div className="flex-1 overflow-y-auto px-4 pb-24 pt-6 [scrollbar-width:none]" style={{ fontFamily: 'var(--font-drive-inter), system-ui, sans-serif' }}>{children}</div>; }
function Sticky({ children }: { children: React.ReactNode }) { return <div className="-mx-4 mt-8 border-t border-[#2A2E3A] bg-[#0D0F14]/95 px-4 pb-5 pt-3 backdrop-blur md:pb-6">{children}</div>; }

export function BookingFlow({ operator, vehicle }: { operator: Operator; vehicle: Vehicle }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<BookingCart>(() => createInitialCart({ operator, vehicle }));
  const bookingId = 'EXQ-2026-K7P4';
  const next = () => setStep((value) => Math.min(value + 1, 6));
  const back = step > 1 ? () => setStep((value) => value - 1) : undefined;
  const confirmationHref = useMemo(() => `/booking/${bookingId}`, [bookingId]);

  return (
    <BookingChrome step={step + 1} onBack={back}>
      {step === 1 && <DatesScreen cart={cart} setCart={setCart} next={next} />}
      {step === 2 && <DriverScreen cart={cart} setCart={setCart} next={next} />}
      {step === 3 && <ExtrasScreen cart={cart} setCart={setCart} next={next} />}
      {step === 4 && <ProtectScreen cart={cart} setCart={setCart} next={next} />}
      {step === 5 && <ReviewScreen cart={cart} goTo={setStep} next={next} />}
      {step === 6 && <PayScreen cart={cart} onPay={() => router.push(confirmationHref)} />}
    </BookingChrome>
  );
}

export function ConfirmationScreen({ bookingId }: { bookingId: string }) {
  const cart = createInitialCart();
  return (
    <PhoneViewport step={8} className="font-[var(--font-drive-inter)]">
      <section className="flex-1 overflow-y-auto px-4 pb-8 pt-2 [scrollbar-width:none]">
        <div className="relative overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922]">
          <div className="relative h-56"><Image src={cart.vehicle.heroImage} alt={cart.vehicle.name} fill sizes="393px" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#161922]" /><div className="absolute right-3 top-3 rounded-full bg-[#C8A664]/10 px-3 py-1 text-xs text-[#C8A664]"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#C8A664]" />Confirmed</div></div>
          <div className="p-4"><HTitle>Your {cart.vehicle.make} is reserved.</HTitle><p className="mt-2 text-sm text-[#9BA1B0]">Booking {bookingId}</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4 text-sm"><Detail label="Dates" value="Jun 14 – Jun 17" /><Detail label="Pickup" value={cart.pickupTime} /><Detail label="Location" value={cart.vehicle.pickupLocation.address} /><Detail label="Total" value={formatMoney(cart.totals.grandTotalCents)} /></div>
        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="mb-3 text-sm font-medium">Charges</div><div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Operator</span><span className="text-xs text-[#C8A664]">Charge from {cart.operator.name}</span></span><Money cents={cart.totals.operatorTotalCents} /></div><div className="flex justify-between border-t border-[#2A2E3A] py-3 text-sm"><span><span className="block">Exotiq Protect</span><span className="text-xs text-[#C8A664]">Charge from Exotiq</span></span><Money cents={cart.totals.protectionTotalCents} /></div></div>
        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8A664]/10 text-[#C8A664]">DE</div><div className="flex-1"><div className="text-sm font-medium">{cart.operator.name}</div><div className="text-xs text-[#9BA1B0]">Will reach out before pickup</div></div><a href={`tel:${cart.operator.phone}`} className="rounded-full border border-[#C8A664]/30 p-2 text-[#C8A664]" aria-label="Call operator"><Phone size={16} /></a></div></div>
        <div className="mt-4 rounded-xl border border-[#2A2E3A] bg-[#161922] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-[#C8A664]" />What happens next</div>{['Operator confirms final handoff details.', 'Driver documents remain encrypted for verification.', 'You receive pickup reminders before the rental.'].map((item, index) => <div key={item} className="flex gap-3 border-t border-[#2A2E3A] py-3 text-sm text-[#9BA1B0]"><span className="text-[#C8A664]">0{index + 1}</span>{item}</div>)}</div>
        <button type="button" className="mt-4 w-full rounded-xl bg-[#C8A664] px-5 py-4 text-sm font-semibold text-[#1A1308]">Share your Exotiq</button>
        <button type="button" className="mt-3 w-full rounded-xl border border-[#2A2E3A] px-5 py-4 text-sm font-semibold text-[#F0F2F5]">Add to calendar</button>
      </section>
    </PhoneViewport>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div><div className="text-[10px] uppercase tracking-[0.2em] text-[#5C6272]">{label}</div><div className="mt-1 text-[#F0F2F5]">{value}</div></div>; }
