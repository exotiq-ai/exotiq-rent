'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useCookieConsent } from './PostHogInit';
import { cookieControlState, toggleOptionalCookies } from './cookieControlsModel';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8A664]';

function Toggle({ label, checked, onClick, disabled = false, master = false, describedBy }: {
  label: string; checked: boolean | 'mixed'; onClick: () => void; disabled?: boolean; master?: boolean; describedBy?: string;
}) {
  return (
    <button
      type="button"
      // ARIA switches cannot express mixed. The combined control is a tri-state
      // checkbox styled as a switch; category controls are ordinary switches.
      role={master ? 'checkbox' : 'switch'}
      aria-label={label}
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-45 ${focusRing}`}
    >
      <span aria-hidden="true" className={`relative h-5 w-[34px] rounded-full border transition-colors motion-reduce:transition-none ${checked === true ? 'border-[#C8A664] bg-[#C8A664]' : checked === 'mixed' ? 'border-[#C8A664] bg-[#C8A664]/30' : 'border-[#465064] bg-[#252B38]'}`}>
        <span className={`absolute left-[3px] top-[3px] h-3 w-3 rounded-full transition-transform motion-reduce:transition-none ${checked === true ? 'translate-x-[14px] bg-[#1A1308]' : checked === 'mixed' ? 'translate-x-[7px] bg-[#C8A664]' : 'bg-[#CDD1D9]'}`} />
      </span>
    </button>
  );
}

/** Inline conversion-surface controls. No SDK ownership, scrim or automatic popup. */
export function CookieControls({ manual = false, viewport = 'all', className = '' }: {
  manual?: boolean;
  viewport?: 'all' | 'mobile' | 'desktop';
  className?: string;
}) {
  const { choice, gpc, ready, visibility, choose, activeDetails, setActiveDetails } = useCookieConsent();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const [inViewport, setInViewport] = useState(viewport === 'all');
  const mode = manual ? 'preferences' : visibility;
  const visible = inViewport && mode !== 'hidden';
  const open = visible && activeDetails === id;
  const state = cookieControlState(choice, gpc);

  const dismiss = useCallback((returnFocus: boolean) => {
    setActiveDetails(current => current === id ? null : current);
    if (returnFocus) opener.current?.focus({ preventScroll: true });
  }, [id, setActiveDetails]);

  useEffect(() => {
    if (viewport === 'all') { setInViewport(true); return; }
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      const matches = viewport === 'desktop' ? media.matches : !media.matches;
      setInViewport(matches);
      if (!matches) dismiss(false);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [viewport, dismiss]);

  useEffect(() => () => {
    setActiveDetails(current => current === id ? null : current);
  }, [id, setActiveDetails]);

  useEffect(() => {
    if (!open) { setPosition(null); return; }
    const anchor = root.current, element = card.current;
    if (!anchor || !element) return;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const view = window.visualViewport;
      const leftEdge = (view?.offsetLeft ?? 0) + 12;
      const topEdge = (view?.offsetTop ?? 0) + 12;
      const rightEdge = leftEdge + (view?.width ?? window.innerWidth) - 24;
      const bottomEdge = topEdge + (view?.height ?? window.innerHeight) - 24;
      if (rect.bottom <= topEdge || rect.top >= bottomEdge) { dismiss(false); return; }
      const width = Math.max(0, Math.min(rect.width, rightEdge - leftEdge));
      // Measure at the actual trigger width before choosing above/below. Fixed
      // positioning escapes the desktop sticky aside's overflow clipping.
      element.style.width = `${width}px`;
      const height = element.scrollHeight + 2;
      const above = Math.max(0, rect.top - 8 - topEdge);
      const below = Math.max(0, bottomEdge - rect.bottom - 8);
      const useAbove = above >= height || above >= below;
      const maxHeight = useAbove ? above : below;
      const top = useAbove ? Math.max(topEdge, rect.top - 8 - Math.min(height, maxHeight)) : rect.bottom + 8;
      const next = { top, left: Math.max(leftEdge, Math.min(rect.left, rightEdge - width)), width, maxHeight };
      setPosition(previous => previous && Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(anchor); observer.observe(element);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [open, dismiss]);

  const positioned = position !== null;
  useEffect(() => {
    if (open && positioned) closeButton.current?.focus({ preventScroll: true });
  }, [open, positioned]);

  useEffect(() => {
    if (!open) return;
    const outsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        // Return focus if it was inside the card; the clicked control still gets
        // its normal browser focus and activation. Never trap keyboard focus.
        dismiss(!!root.current?.contains(document.activeElement));
      }
    };
    const outsideFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dismiss(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(true); }
    };
    document.addEventListener('pointerdown', outsidePointer);
    document.addEventListener('focusin', outsideFocus);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outsidePointer);
      document.removeEventListener('focusin', outsideFocus);
      document.removeEventListener('keydown', escape);
    };
  }, [open, dismiss]);

  // Responsive instances do not leave hidden interactive controls or dialogs.
  if (!visible) return null;
  return (
    <div ref={root} data-cookie-controls={mode} className={`relative -mt-1 mb-1.5 font-[var(--font-drive-inter)] text-[#9BA1B0] ${className}`}>
      <div className="flex min-h-11 items-center gap-2">
        {mode === 'row' && <span className="flex-1 text-[12px] font-normal tracking-[.01em]">{open ? 'Your privacy choices' : 'Optional cookies'}</span>}
        <button
          ref={opener}
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-details`}
          disabled={!ready}
          className={`min-h-11 min-w-11 rounded px-0.5 text-[11px] underline underline-offset-[3px] ${focusRing}`}
          onClick={() => open ? dismiss(true) : setActiveDetails(id)}
        >{mode === 'preferences' ? 'Privacy preferences' : open ? 'Done' : 'Details'}</button>
        {mode === 'row' && !open && <>
          <Toggle
            master
            label={`Optional cookies: ${state.label}. ${state.checked === false ? 'Switch on to allow optional cookies' : 'Switch off to disable both'}.`}
            checked={state.checked}
            describedBy={`${id}-state`}
            onClick={() => choose(toggleOptionalCookies(choice, gpc))}
          />
          <span id={`${id}-state`} aria-live="polite" className="min-w-[36px] text-right text-[10px] tracking-[.05em]">{state.label}</span>
        </>}
      </div>
      {open && (
        <section
          ref={card}
          id={`${id}-details`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-title`}
          style={position ? { ...position, visibility: 'visible' } : { visibility: 'hidden' }}
          className="fixed z-[60] overflow-y-auto rounded-[14px] border border-[#353B49] bg-[#161922] px-4 pb-2 pt-3 text-[#F0F2F5] shadow-[0_12px_35px_#0008]"
        >
          <div className="-mr-1.5 -mt-1 flex items-center justify-between gap-2">
            <span id={`${id}-title`} className="text-[14px] font-medium">Cookie preferences</span>
            <button ref={closeButton} type="button" aria-label="Close cookie preferences" onClick={() => dismiss(true)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#9BA1B0] ${focusRing}`}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="m3 3 8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" /></svg>
            </button>
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-[#2A2E3A]">
            <div><span className="block text-[12px] font-medium">Analytics</span><p className="mt-px text-[11px] leading-4 text-[#9BA1B0]">Help us improve the experience.</p></div>
            <Toggle label="Analytics cookies" checked={choice.analytics} onClick={() => choose({ ...choice, analytics: !choice.analytics })} />
          </div>
          <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-[#2A2E3A]">
            <div><span className="block text-[12px] font-medium">Advertising</span><p className="mt-px text-[11px] leading-4 text-[#9BA1B0]">Help us measure our ads.</p></div>
            <Toggle label="Advertising cookies" checked={choice.marketing && !gpc} disabled={gpc} describedBy={gpc ? `${id}-gpc` : undefined} onClick={() => choose({ ...choice, marketing: !choice.marketing })} />
          </div>
          {gpc && <p id={`${id}-gpc`} role="status" className="mt-2 text-[11px] leading-4 text-[#9BA1B0]">Global Privacy Control is enabled. Advertising is disabled.</p>}
          <div className="flex items-center justify-between gap-2 text-[10px] leading-4 text-[#9BA1B0]">
            <span>Changes apply instantly.</span>
            <a href="/privacy" className={`inline-flex min-h-11 items-center rounded text-[#C8A664] underline underline-offset-[3px] ${focusRing}`}>Privacy notice</a>
          </div>
        </section>
      )}
    </div>
  );
}
