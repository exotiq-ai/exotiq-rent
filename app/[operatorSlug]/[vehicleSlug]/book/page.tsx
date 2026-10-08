import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TrackView } from '@/components/analytics/TrackView';
import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getSiteMode } from '@/domain/booking/config';
import { parseDateWindow } from '@/domain/booking/marketplaceQuery';
import { getBookingStartContext } from '@/domain/booking/service';

type Props = { params: Promise<{ operatorSlug: string; vehicleSlug: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params: pendingParams }: Props): Promise<Metadata> {
  const params = await pendingParams;
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow.
  if (getSiteMode() === 'marketplace') notFound();
  const teamSlug = params.operatorSlug;
  const result = await getBookingStartContext(teamSlug, params.vehicleSlug);
  if (!result) return { title: 'Vehicle not found | Drive Exotiq' };
  return {
    title: `Book ${result.vehicle.shortName} | Drive Exotiq`,
    description: `Complete your Drive Exotiq booking with ${result.team.name}.`,
  };
}

export default async function BookRoute({ params: pendingParams, searchParams: pendingSearch }: Props) {
  const params = await pendingParams, searchParams = await pendingSearch;
  const teamSlug = params.operatorSlug;
  const result = await getBookingStartContext(teamSlug, params.vehicleSlug);
  if (!result) notFound();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const initialDates = parseDateWindow(one(searchParams?.start), one(searchParams?.end));
  return (
    <div className={driveFontClassName}>
      <BookingFlow operator={result.team} vehicle={result.vehicle} initialDates={initialDates} />
      <TrackView event="book_start" properties={{ team: params.operatorSlug, vehicle: params.vehicleSlug }} />
    </div>
  );
}
