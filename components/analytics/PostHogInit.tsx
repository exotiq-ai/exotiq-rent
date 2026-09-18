'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getTracking, globalPrivacyControl, storedConsent, syncStoredConsent } from './posthog';
import { DENIED, type Consent } from './policy';

/** Global, in-flow preferences remain usable on private/legal pages without loading a SDK. */
export function PostHogInit() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const controls = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [banner, setBanner] = useState(false);
  const [choice, setChoice] = useState<Consent>({ ...DENIED });
  const [gpc, setGpc] = useState(false);

  useEffect(() => {
    const element = controls.current;
    if (!element) return;
    const measure = () => document.documentElement.style.setProperty('--privacy-controls-height', `${element.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--privacy-controls-height'); };
  }, []);

  useEffect(() => {
    getTracking()?.navigate();
  }, [pathname]);

  useEffect(() => {
    const tracker = getTracking();
    setChoice(tracker?.consent() || { ...DENIED });
    setGpc(globalPrivacyControl());
    setBanner(!storedConsent() && process.env.NEXT_PUBLIC_TRACKING_ENABLED === 'true' && process.env.NEXT_PUBLIC_EXOTIQ_RENT_DATA_MODE === 'supabase' && window.location.hostname === 'book.exotiq.rent');
    const navigate = () => tracker?.navigate();
    const sync = (event: StorageEvent) => {
      const next = syncStoredConsent(event);
      if (next === undefined) return;
      setChoice(next || { ...DENIED }); setBanner(!next);
    };
    window.addEventListener('popstate', navigate);
    window.addEventListener('hashchange', navigate);
    window.addEventListener('storage', sync);
    // Guard query-only and unanticipated SPA transitions too, before another SDK event can run.
    const push = window.history.pushState, replace = window.history.replaceState;
    const pushGuard: History['pushState'] = function (...args) { push.apply(window.history, args); navigate(); };
    const replaceGuard: History['replaceState'] = function (...args) { replace.apply(window.history, args); navigate(); };
    window.history.pushState = pushGuard; window.history.replaceState = replaceGuard;
    return () => {
      window.removeEventListener('popstate', navigate); window.removeEventListener('hashchange', navigate); window.removeEventListener('storage', sync);
      if (window.history.pushState === pushGuard) window.history.pushState = push;
      if (window.history.replaceState === replaceGuard) window.history.replaceState = replace;
    };
  }, []);

  function open() {
    setChoice(getTracking()?.consent() || { ...DENIED }); setGpc(globalPrivacyControl());
    dialog.current?.showModal();
  }
  function close() { dialog.current?.close(); opener.current?.focus(); }
  function save(next: Consent) {
    const effective = { ...next, marketing: next.marketing && !globalPrivacyControl() };
    getTracking()?.choose(effective); setChoice(effective); setBanner(false); close();
  }
  const button = 'rounded-md border border-white/30 px-3 py-2 text-xs font-medium hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
  return (
    <aside ref={controls} aria-label="Privacy choices" className="relative z-50 border-b border-white/10 bg-[#101216] px-4 py-2 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs">
        {banner ? <p className="max-w-xl text-white/80">Optional analytics and advertising are off until you choose. Essential booking features work without them.</p> : <span className="text-white/60">Your privacy choices</span>}
        <div className="flex flex-wrap items-center gap-2">
          {banner && <>
            <button type="button" className={button} onClick={() => save({ ...DENIED })}>Reject optional</button>
            <button type="button" className={button} onClick={() => save({ analytics: true, marketing: true })}>Accept all</button>
          </>}
          <button ref={opener} type="button" className="rounded px-2 py-2 text-xs underline underline-offset-4 focus-visible:outline focus-visible:outline-2" onClick={open}>Privacy preferences</button>
        </div>
      </div>
      <dialog ref={dialog} aria-labelledby="privacy-preferences-title" aria-describedby="privacy-preferences-description" onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-white/20 bg-[#101216] p-6 text-white shadow-2xl backdrop:bg-black/70">
        <div className="flex items-start justify-between gap-3">
          <h2 id="privacy-preferences-title" className="text-lg font-semibold">Privacy preferences</h2>
          <button type="button" aria-label="Close privacy preferences" onClick={close} className={button}>Close</button>
        </div>
        <p id="privacy-preferences-description" className="mt-3 text-sm leading-6 text-white/75">Choose independently. Rejecting optional tracking will not affect your booking. You can change your choice here at any time. <a href="/privacy" className="underline">Privacy notice</a></p>
        <p className="mt-4 text-sm text-white/75"><strong className="text-white">Essential — always on.</strong> Booking security and remembering these preferences.</p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={choice.analytics} onChange={event => setChoice(c => ({ ...c, analytics: event.target.checked }))} className="mt-1 h-4 w-4" />
          <span><strong>Analytics (PostHog)</strong><span className="mt-1 block leading-5 text-white/75">Understand public fleet browsing and booking requests. No session recording or form-field capture.</span></span>
        </label>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" checked={choice.marketing && !gpc} disabled={gpc} onChange={event => setChoice(c => ({ ...c, marketing: event.target.checked }))} className="mt-1 h-4 w-4" />
          <span><strong>Advertising (Meta Pixel)</strong><span className="mt-1 block leading-5 text-white/75">Measure ads, public vehicle views and booking requests. No contact details or purchase events are shared.</span></span>
        </label>
        {gpc && <p role="status" className="mt-3 text-sm text-white/75">Global Privacy Control is enabled. Advertising is disabled.</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => save({ ...DENIED })}>Reject optional</button>
          <button type="button" className={button} onClick={() => save({ analytics: true, marketing: true })}>Accept all</button>
          <button type="button" className={button} onClick={() => save(choice)}>Save choice</button>
        </div>
      </dialog>
    </aside>
  );
}
