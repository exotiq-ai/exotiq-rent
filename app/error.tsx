'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { PageFrame } from '@/components/browse/PageFrame';
import { ctaClassName, ctaOutlineClassName, serifStyle } from '@/components/browse/tokens';
import { homeLink } from '@/domain/booking/config';

/**
 * The segment error boundary (MP-18): what a renter sees when a server render throws (a data call
 * fails, or supabase mode lacks its URL/key), in the 404's voice and on the same PageFrame the
 * 404s wear (MP-17). It never prints error.message or a stack; Next's digest shows only as a
 * reference. It claims nothing about charges or booking state, and tells a renter mid-booking to
 * check their email before retrying. Its imports stop at the frame, the tokens and homeLink(): no
 * analytics, no consent control, no booking chrome, so it cannot fail for the reasons it exists.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const home = homeLink();
  // Re-run the server render, then re-mount the segment; one retry at a time.
  const retry = () => {
    if (pending) return;
    startTransition(() => {
      router.refresh();
      reset();
    });
  };
  return (
    <PageFrame homeHref={home.href}>
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-muted"><TriangleAlert size={24} aria-hidden /></div>
        <h1 className="mt-5 text-title leading-[1.12] text-ink" style={serifStyle}>That didn&apos;t go to plan.</h1>
        <p className="mt-3 text-body leading-6 text-muted">Something went wrong on our side while loading this page. Give it another try. If you were in the middle of a booking, check your email for a confirmation before you retry.</p>
        {error.digest && <p className="mt-3 text-label text-faint">Reference: {error.digest}</p>}
        <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
          <button type="button" onClick={retry} aria-busy={pending} className={`rounded-xl px-6 py-3.5 text-body font-semibold ${ctaClassName}`}>
            {pending ? 'Trying again…' : 'Try again'}
          </button>
          <Link href={home.href} className={`rounded-xl px-6 py-3.5 text-center text-body font-semibold ${ctaOutlineClassName}`}>{home.label}</Link>
        </div>
      </section>
    </PageFrame>
  );
}
