'use client';

import { useState, type MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { track } from '@/components/analytics/posthog';
import { renterCaptureUiEnabled } from '@/domain/renters/flags';
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
  const heart = <Heart size={size} strokeWidth={1.75} className={`${saved ? 'fill-ink text-ink' : 'text-muted'} ${bounce ? 'animate-heart-bounce' : ''}`} onAnimationEnd={() => setBounce(false)} aria-hidden />;
  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={`Save ${car.name}`}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-body-sm font-medium text-ink transition hover:border-gold/45 active:scale-[0.98] ${className}`}
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
      aria-label={`Save ${car.name}`}
      title={saved ? 'Saved' : 'Save this car'}
      className={`grid h-9 w-9 place-items-center rounded-full border border-gold/25 bg-panel/70 text-ink backdrop-blur transition hover:border-gold/60 hover:text-gold active:scale-95 ${className}`}
    >
      {heart}
    </button>
  );
}
