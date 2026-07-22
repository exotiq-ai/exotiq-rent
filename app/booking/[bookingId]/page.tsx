import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmationScreen } from '@/components/drive-exotiq/ConfirmationScreen';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getSiteMode } from '@/domain/booking/config';
import { getBookingConfirmation } from '@/domain/booking/service';

type Props = { params: { bookingId: string }; searchParams: { t?: string } };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  // Marketplace-mode deploys (exotiq.rent) do not route the booking flow.
  if (getSiteMode() === 'marketplace') notFound();
  const lookup = await getBookingConfirmation(params.bookingId, searchParams.t);
  // Before streaming starts, so the HTTP status stays 404 (see storefront route).
  if (!lookup) notFound();
  if ('restricted' in lookup) {
    return { title: `Booking ${lookup.bookingRef} | Drive Exotiq`, description: 'Drive Exotiq booking.' };
  }
  return {
    title: `Your ${lookup.vehicle.make} is reserved | Drive Exotiq`,
    description: 'Drive Exotiq booking confirmation.',
  };
}

export default function ConfirmationRoute({ params, searchParams }: Props) {
  return <div className={driveFontClassName}><ConfirmationScreen bookingRef={params.bookingId} accessToken={searchParams.t} /></div>;
}
