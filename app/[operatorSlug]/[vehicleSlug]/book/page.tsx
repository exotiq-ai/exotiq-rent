import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getSiteMode } from '@/domain/booking/config';
import { getBookingStartContext } from '@/domain/booking/service';

type Props = { params: { operatorSlug: string; vehicleSlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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

export default async function BookRoute({ params }: Props) {
  const teamSlug = params.operatorSlug;
  const result = await getBookingStartContext(teamSlug, params.vehicleSlug);
  if (!result) notFound();
  return <div className={driveFontClassName}><BookingFlow operator={result.team} vehicle={result.vehicle} /></div>;
}
