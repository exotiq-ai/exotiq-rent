import type { ReactNode } from 'react';
import { BrowseChrome } from './BrowseChrome';
import { displaySerifStyle, eyebrowClassName } from './tokens';

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
        <p className={`${eyebrowClassName} text-faint`}>{eyebrow}</p>
        <h1 className="mt-3 text-display leading-[1.05] text-ink sm:text-display-lg sm:leading-[1.05]" style={displaySerifStyle}>{title}</h1>
        <p className="mt-3 text-label text-faint">Last updated {updated}</p>
        {/* The anchor rules skip anything inside the consent controls: /privacy renders
            them inside this prose, and their own link colour is not ours to change. */}
        <div className="mt-10 space-y-8 text-body leading-7 text-muted [&_h2]:mb-2 [&_h2]:text-label [&_h2]:leading-7 [&_h2]:uppercase [&_h2]:tracking-[0.2em] [&_h2]:text-faint [&_strong]:text-ink [&_a:not([data-cookie-controls]_a)]:text-ink [&_a:not([data-cookie-controls]_a)]:underline [&_a:not([data-cookie-controls]_a)]:decoration-faint [&_a:not([data-cookie-controls]_a)]:underline-offset-4">
          {children}
        </div>
      </article>
    </BrowseChrome>
  );
}

export function InterimNotice({ what }: { what: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 text-body leading-6">
      <strong>Interim version.</strong> {what} The final text is being reviewed by counsel before public launch and will replace this page; the date above will change when it does.
    </div>
  );
}
