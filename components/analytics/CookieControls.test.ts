import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieControls } from './CookieControls';

const shared = vi.hoisted(() => ({
  choice: { analytics: false, marketing: false }, gpc: false, ready: true,
  visibility: 'row', activeDetails: null as string | null,
  choose: vi.fn(), setActiveDetails: vi.fn(),
}));
vi.mock('./PostHogInit', () => ({ useCookieConsent: () => shared }));
const render = (props: React.ComponentProps<typeof CookieControls> = {}) => renderToStaticMarkup(React.createElement(CookieControls, props));
function expanded() {
  const closed = render();
  shared.activeDetails = closed.match(/aria-controls="([^"]+)-details"/)![1];
  return render();
}

beforeEach(() => {
  shared.choice = { analytics: false, marketing: false }; shared.gpc = false; shared.ready = true;
  shared.visibility = 'row'; shared.activeDetails = null; vi.clearAllMocks();
});

describe('compact cookie control markup', () => {
  it('starts as a quiet collapsed row, not an automatically opened dialog', () => {
    const html = render();
    expect(html).toContain('Optional cookies'); expect(html).toContain('Details'); expect(html).toContain('Off');
    expect(html).toContain('aria-expanded="false"'); expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('role="dialog"'); expect(html).not.toContain('Save choice');
  });
  it('exposes a true mixed state for a granular choice, not a falsely enabled switch', () => {
    shared.choice = { analytics: true, marketing: false };
    const html = render();
    expect(html).toContain('Custom'); expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="mixed"'); expect(html).toContain('Switch off to disable both');
  });
  it('renders independent switches only in the explicitly opened nonmodal card', () => {
    const html = expanded();
    expect(html).toContain('role="dialog"'); expect(html).toContain('aria-modal="false"');
    expect(html).toContain('Analytics cookies'); expect(html).toContain('Advertising cookies');
    expect(html).toContain('Changes apply instantly.'); expect(html).toContain('href="/privacy"');
    expect(html).toContain('Close cookie preferences');
    expect(html.match(/role="switch"/g)).toHaveLength(2);
    expect(html).not.toContain('role="checkbox"'); // No redundant master while editing categories.
    expect(html).not.toContain('<dialog'); expect(html).not.toContain('backdrop');
  });
  it('shows GPC and disables advertising even when stored consent was previously on', () => {
    shared.gpc = true; shared.choice = { analytics: true, marketing: true };
    const html = expanded();
    expect(html).toContain('Global Privacy Control');
    const advertising = html.match(/<button[^>]*aria-label="Advertising cookies"[^>]*>/)![0];
    expect(advertising).toContain('aria-checked="false"'); expect(advertising).toContain('disabled=""');
  });
  it('renders nothing for a new visitor outside scope', () => {
    shared.visibility = 'hidden'; expect(render()).toBe('');
  });
  it('renders only a manual entry for saved preferences outside scope', () => {
    shared.visibility = 'preferences';
    const html = render(); expect(html).toContain('Privacy preferences');
    expect(html).not.toContain('Optional cookies'); expect(html).not.toContain('role="checkbox"');
  });
  it('makes the privacy-page manual entry available even with no automatic prompt', () => {
    shared.visibility = 'hidden'; expect(render({ manual: true })).toContain('Privacy preferences');
  });
  it('gives simultaneous instances distinct dialog and state IDs', () => {
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(CookieControls), React.createElement(CookieControls)));
    const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g)).map(match => match[1]);
    const controls = Array.from(html.matchAll(/aria-controls="([^"]+)"/g)).map(match => match[1]);
    expect(ids.length).toBeGreaterThan(0); expect(new Set(ids).size).toBe(ids.length);
    expect(controls).toHaveLength(2); expect(new Set(controls).size).toBe(2);
  });
});
