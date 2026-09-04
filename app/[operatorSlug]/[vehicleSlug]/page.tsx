import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TrackView } from '@/components/analytics/TrackView';
import { VehicleEntryPage } from '@/components/drive-exotiq/VehicleEntryPage';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getSiteMode } from '@/domain/booking/config';
import { getPublicVehicleContext } from '@/domain/booking/service';
import { parseDateWindow } from '@/domain/booking/marketplaceQuery';
import { formatMoney } from '@/domain/booking/totals';

type Props = { params: { operatorSlug: string; vehicleSlug: string }; searchParams?: Record<string, string | string[] | undefined> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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
    openGraph: {
      title: `${vehicle.name} | Drive Exotiq`,
      description: `From ${formatMoney(vehicle.dailyRateCents)}/day. ${team.city}, ${team.state}.`,
      images: vehicle.heroImage ? [vehicle.heroImage] : [],
    },
  };
}

export default async function VehicleRoute({ params, searchParams }: Props) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const dates = parseDateWindow(one(searchParams?.start), one(searchParams?.end));
  return (
    <div className={driveFontClassName}>
      {await VehicleEntryPage({ operatorSlug: params.operatorSlug, vehicleSlug: params.vehicleSlug, dates })}
      <TrackView event="vehicle_view" properties={{ team: params.operatorSlug, vehicle: params.vehicleSlug }} />
    </div>
  );
}
