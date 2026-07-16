import type { Metadata } from 'next';
import { ConfirmationScreen } from '@/components/drive-exotiq/ConfirmationScreen';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';

export const metadata: Metadata = {
  title: 'Your McLaren is reserved | Drive Exotiq',
  description: 'Drive Exotiq booking confirmation.',
};

export default function ConfirmationRoute({ params }: { params: { bookingId: string } }) {
  return <div className={driveFontClassName}><ConfirmationScreen bookingRef={params.bookingId} /></div>;
}
