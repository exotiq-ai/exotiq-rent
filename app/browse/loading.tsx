import { BrowseChrome } from '@/components/browse/BrowseChrome';
import { containerClassName } from '@/components/browse/tokens';

/** Skeleton for the browse grid — same spine as the loaded page so nothing jumps. */
export default function BrowseLoading() {
  return (
    <BrowseChrome>
      <section className={`${containerClassName} pb-6 pt-12 sm:pt-16`}>
        <div className="h-3 w-24 rounded bg-[#161922]" />
        <div className="mt-4 h-12 w-56 rounded bg-[#161922]" />
        <div className="mt-4 h-4 w-80 max-w-full rounded bg-[#161922]" />
      </section>
      <section className={`${containerClassName} lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10`}>
        <aside className="hidden lg:block"><div className="h-96 rounded-2xl border border-[#2A2E3A] bg-[#0D0F14]" /></aside>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-[#2A2E3A] bg-[#161922]">
              <div className="aspect-[4/3] bg-[#1E2230]" />
              <div className="space-y-2 p-4"><div className="h-4 w-2/3 rounded bg-[#1E2230]" /><div className="h-3 w-1/3 rounded bg-[#1E2230]" /></div>
            </div>
          ))}
        </div>
      </section>
    </BrowseChrome>
  );
}
