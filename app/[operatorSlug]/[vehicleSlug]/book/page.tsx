import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingFlow } from '@/components/drive-exotiq/BookingFlow';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { findMockVehicle } from '@/domain/booking/mockData';

type Props = { params: { operatorSlug: string; vehicleSlug: string } };

export function generateMetadata({ params }: Props): Metadata {
  const result = findMockVehicle(params.operatorSlug, params.vehicleSlug);
  if (!result) return { title: 'Vehicle not found | Drive Exotiq' };
  return {
    title: `Book ${result.vehicle.shortName} | Drive Exotiq`,
    description: `Complete your Drive Exotiq booking with ${result.operator.name}.`,
  };
}

export default function BookRoute({ params }: Props) {
  const result = findMockVehicle(params.operatorSlug, params.vehicleSlug);
  if (!result) notFound();
  return <div className={driveFontClassName}><BookingFlow operator={result.operator} vehicle={result.vehicle} /></div>;
}
