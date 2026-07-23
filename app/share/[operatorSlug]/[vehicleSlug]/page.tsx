import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getSiteMode } from '@/domain/booking/config';
import { getPublicVehicleContext } from '@/domain/booking/service';

/**
 * Public share card — hype only, by design. No booking ref, dates, or money
 * ever appear here: this URL is what renters text their friends, and the
 * booking itself stays private on the token-gated confirmation page.
 */
type Props = { params: { operatorSlug: string; vehicleSlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (getSiteMode() === 'marketplace') notFound();
  const result = await getPublicVehicleContext(params.operatorSlug, params.vehicleSlug);
  if (!result) notFound();
  const { team, vehicle } = result;
  const description = `The ${vehicle.name} is spoken for. Reserved for an upcoming drive with Drive Exotiq — ${team.city}, ${team.state}.`;
  return {
    title: `${vehicle.name} · Reserved | Drive Exotiq`,
    description,
    // Override the root layout's marketplace OG block so unfurls carry the
    // share card, not the generic site branding. The image comes from the
    // sibling opengraph-image.tsx via metadataBase.
    openGraph: {
      title: `${vehicle.name} · Reserved on Drive Exotiq`,
      description,
      siteName: 'Drive Exotiq',
      type: 'website',
    },
  };
}

export default async function SharePage({ params }: Props) {
  if (getSiteMode() === 'marketplace') notFound();
  const result = await getPublicVehicleContext(params.operatorSlug, params.vehicleSlug);
  if (!result) notFound();
  const { team, vehicle } = result;

  return (
    <main className={`${driveFontClassName} min-h-dvh bg-[#0B0D12] font-[var(--font-drive-inter)] text-[#F0F2F5]`}>
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-8">
        <div className="text-center text-[11px] uppercase tracking-[0.32em] text-[#C8A664]">Drive Exotiq</div>
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-[#C8A664]/40 shadow-[0_0_0_1px_rgba(200,166,100,0.15),0_24px_60px_rgba(0,0,0,0.55)]">
          <div className="relative h-[300px]">
            <Image src={vehicle.heroImage} alt={vehicle.name} fill sizes="480px" priority className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-[#0B0D12]" />
            <div className="absolute left-4 top-4 rounded-full bg-[#0B0D12]/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-[#C8A664] backdrop-blur">
              <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#C8A664] align-middle" />
              Reserved
            </div>
          </div>
          <div className="bg-[#0B0D12] px-5 pb-6 pt-1 text-center">
            <h1 className="text-[30px] leading-tight" style={{ fontFamily: 'var(--font-drive-newsreader), Georgia, serif', fontWeight: 500, letterSpacing: '-0.018em' }}>This one&apos;s spoken for.</h1>
            <p className="mt-2 text-sm leading-6 text-[#9BA1B0]">The {vehicle.name} — reserved for an upcoming drive out of {team.city}, {team.state}.</p>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          <Link href={`/${params.operatorSlug}/${params.vehicleSlug}`} className="w-full rounded-xl bg-[#C8A664] px-5 py-4 text-center text-sm font-semibold text-[#1A1308]">
            See this car
          </Link>
          <Link href={`/${params.operatorSlug}`} className="w-full rounded-xl border border-[#2A2E3A] px-5 py-4 text-center text-sm font-semibold text-[#F0F2F5]">
            Explore the {team.name} fleet
          </Link>
        </div>
        <p className="mt-auto pt-10 text-center text-[11px] leading-5 text-[#5C6272]">Curated exotic &amp; luxury rentals · drive.exotiq</p>
      </div>
    </main>
  );
}
