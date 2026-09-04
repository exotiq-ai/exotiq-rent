'use client';

import { useState, type MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { track } from '@/components/analytics/posthog';
import { renterCaptureUiEnabled } from '@/domain/renters/config';
import { useSaved, type SavedCar } from './savedStore';

/**
 * The heart (MP-14). A real button that never lives inside the card's link:
 * the card wraps both, so a tap on the heart saves and a tap anywhere else
 * opens the car. Gold when saved, with the mockup's bounce.
 */
export function SaveButton({ car, className = '', size = 16, variant = 'icon' }: { car: Omit<SavedCar, 'savedAt'>; className?: string; size?: number; /** `pill` adds a Save/Saved label — for the vehicle page beside the book button. */ variant?: 'icon' | 'pill' }) {
  const { has, toggle, ready } = useSaved();
  const [bounce, setBounce] = useState(false);
  if (!renterCaptureUiEnabled()) return null;
  const saved = ready && has(car.team_slug, car.vehicle_slug);
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const now = toggle(car);
    if (now) {
      setBounce(true);
      track('favourite_added', { team: car.team_slug, vehicle: car.vehicle_slug });
    }
  };
  const heart = <Heart size={size} strokeWidth={1.75} className={`${saved ? 'fill-[#C8A664] text-[#C8A664]' : ''} ${bounce ? 'animate-heart-bounce' : ''}`} onAnimationEnd={() => setBounce(false)} aria-hidden />;
  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${car.name} from your saved cars` : `Save ${car.name}`}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-[#2A2E3A] bg-[#161922] px-4 py-3 text-[13px] font-medium text-[#F0F2F5] transition hover:border-[#C8A664]/45 active:scale-[0.98] ${className}`}
      >
        {heart}
        {saved ? 'Saved' : 'Save'}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${car.name} from your saved cars` : `Save ${car.name}`}
      title={saved ? 'Saved' : 'Save this car'}
      className={`grid h-9 w-9 place-items-center rounded-full border border-[#C8A664]/25 bg-[#0D0F14]/70 text-[#F0F2F5] backdrop-blur transition hover:border-[#C8A664]/60 hover:text-[#C8A664] active:scale-95 ${className}`}
    >
      {heart}
    </button>
  );
}
