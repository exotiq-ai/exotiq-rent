import type { ReactNode } from 'react';
import { BrowseChrome } from './BrowseChrome';
import { serifStyle } from './tokens';

/**
 * Shell for /terms and /privacy (M7e / MP-6). The routes exist so the footer
 * never links to a 404; the text is owner-clock (counsel pass on the launch
 * checklist), so each page says plainly what is settled and what is still
 * being finalised rather than dressing a draft up as final.
 */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <BrowseChrome view={null}>
      <article className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#848A9A]">{eyebrow}</p>
        <h1 className="mt-3 text-[36px] leading-[1.05] text-[#F0F2F5] sm:text-[48px]" style={{ ...serifStyle, letterSpacing: '-0.02em' }}>{title}</h1>
        <p className="mt-3 text-[12px] text-[#848A9A]">Last updated {updated}</p>
        <div className="mt-10 space-y-8 text-[15px] leading-7 text-[#9BA1B0] [&_h2]:mb-2 [&_h2]:text-[13px] [&_h2]:uppercase [&_h2]:tracking-[0.2em] [&_h2]:text-[#C8A664] [&_strong]:text-[#F0F2F5] [&_a]:text-[#C8A664] [&_a]:underline [&_a]:decoration-[#C8A664]/40 [&_a]:underline-offset-4">
          {children}
        </div>
      </article>
    </BrowseChrome>
  );
}

export function InterimNotice({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-[#C8A664]/30 bg-[#161922] p-5 text-[14px] leading-6">
      <strong>Interim version.</strong> {what} The final text is being reviewed by counsel before public launch and will replace this page; the date above will change when it does.
    </div>
  );
}
