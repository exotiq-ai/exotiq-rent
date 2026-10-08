import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TrackView } from '@/components/analytics/TrackView';
import { VehicleEntryPage } from '@/components/drive-exotiq/VehicleEntryPage';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getSiteMode } from '@/domain/booking/config';
import { getPublicVehicleContext } from '@/domain/booking/service';
import { parseDateWindow } from '@/domain/booking/marketplaceQuery';
import { formatMoney } from '@/domain/booking/totals';
import { vehicleOpenGraph } from '@/domain/booking/seo';

type Props = { params: Promise<{ operatorSlug: string; vehicleSlug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params: pendingParams }: Props): Promise<Metadata> {
  const params = await pendingParams;
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow.
  if (getSiteMode() === 'marketplace') notFound();
  const teamSlug = params.operatorSlug;
  const result = await getPublicVehicleContext(teamSlug, params.vehicleSlug);
  // Before streaming starts, so the HTTP status stays 404 (see storefront route).
  if (!result) notFound();
  const { team, vehicle } = result;
  return {
    title: `${vehicle.name} | ${team.name} | Drive Exotiq`,
    description: `From ${formatMoney(vehicle.dailyRateCents)}/day. ${team.city}, ${team.state}. Book with Drive Exotiq.`,
    // Dated variants (?start&end from a grid) are the same page.
    alternates: { canonical: `/${team.slug}/${vehicle.slug}` },
    // Never an empty images list: a car without a hero unfurls the floor card (MP-18).
    openGraph: vehicleOpenGraph(team, vehicle),
  };
}

export default async function VehicleRoute({ params: pendingParams, searchParams: pendingSearch }: Props) {
  const params = await pendingParams, searchParams = await pendingSearch;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dates = parseDateWindow(one(searchParams?.start), one(searchParams?.end));
  return (
    <div className={driveFontClassName}>
      {await VehicleEntryPage({ operatorSlug: params.operatorSlug, vehicleSlug: params.vehicleSlug, dates })}
      <TrackView event="vehicle_view" properties={{ team: params.operatorSlug, vehicle: params.vehicleSlug }} />
    </div>
  );
}
