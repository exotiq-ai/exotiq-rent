import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConfirmationScreen } from '@/components/drive-exotiq/ConfirmationScreen';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getBookingConfirmation } from '@/domain/booking/service';

export async function generateMetadata({ params }: { params: { bookingId: string } }): Promise<Metadata> {
  const confirmation = await getBookingConfirmation(params.bookingId);
  // Before streaming starts, so the HTTP status stays 404 (see storefront route).
  if (!confirmation) notFound();
  return {
    title: `Your ${confirmation.vehicle.make} is reserved | Drive Exotiq`,
    description: 'Drive Exotiq booking confirmation.',
  };
}

export default function ConfirmationRoute({ params }: { params: { bookingId: string } }) {
  return <div className={driveFontClassName}><ConfirmationScreen bookingRef={params.bookingId} /></div>;
}
