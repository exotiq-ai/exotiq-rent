'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Saved cars live in the browser (MP-14). No account, no cookie, no server
 * round-trip: a heart writes to localStorage, and "e-mail me my list" is the
 * moment the list leaves the device — with the person's e-mail and consent.
 */
export type SavedCar = {
  team_slug: string;
  vehicle_slug: string;
  name: string;
  href: string;
  priceCents?: number;
  savedAt: string;
};

const KEY = 'dx.saved.v1';
const EVENT = 'dx:saved-change';
const MAX = 60;

export function savedKey(teamSlug: string, vehicleSlug: string): string {
  return `${teamSlug}/${vehicleSlug}`;
}

function valid(item: unknown): item is SavedCar {
  if (!item || typeof item !== 'object') return false;
  const c = item as Record<string, unknown>;
  return typeof c.team_slug === 'string' && typeof c.vehicle_slug === 'string' && typeof c.name === 'string' && typeof c.href === 'string';
}

export function readSaved(): SavedCar[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(valid) : [];
  } catch {
    return [];
  }
}

function write(list: SavedCar[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Private mode or a full store: the heart still toggles for this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Returns the new state: true when the car is now saved. */
export function toggleSaved(car: Omit<SavedCar, 'savedAt'>): boolean {
  const list = readSaved();
  const key = savedKey(car.team_slug, car.vehicle_slug);
  const without = list.filter((c) => savedKey(c.team_slug, c.vehicle_slug) !== key);
  if (without.length !== list.length) {
    write(without);
    return false;
  }
  write([{ ...car, savedAt: new Date().toISOString() }, ...without]);
  return true;
}

export function removeSaved(teamSlug: string, vehicleSlug: string): void {
  const key = savedKey(teamSlug, vehicleSlug);
  write(readSaved().filter((c) => savedKey(c.team_slug, c.vehicle_slug) !== key));
}

/** Live view of the saved list. Empty until mounted, so server and first client render agree. */
export function useSaved(): { saved: SavedCar[]; ready: boolean; has: (teamSlug: string, vehicleSlug: string) => boolean; toggle: typeof toggleSaved; remove: typeof removeSaved } {
  const [saved, setSaved] = useState<SavedCar[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const refresh = () => setSaved(readSaved());
    refresh();
    setReady(true);
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const has = useCallback((t: string, v: string) => saved.some((c) => c.team_slug === t && c.vehicle_slug === v), [saved]);
  return { saved, ready, has, toggle: toggleSaved, remove: removeSaved };
}
