import type { Metadata } from 'next';
import { VehicleEntryPage } from '@/components/drive-exotiq/VehicleEntryPage';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { findMockVehicle } from '@/domain/booking/mockData';
import { formatMoney } from '@/domain/booking/totals';

type Props = { params: { operatorSlug: string; vehicleSlug: string } };

export function generateMetadata({ params }: Props): Metadata {
  const result = findMockVehicle(params.operatorSlug, params.vehicleSlug);
  if (!result) return { title: 'Vehicle not found | Drive Exotiq' };
  const { operator, vehicle } = result;
  return {
    title: `${vehicle.name} | ${operator.name} | Drive Exotiq`,
    description: `From ${formatMoney(vehicle.dailyRateCents)}/day. ${operator.city}, ${operator.state}. Book with Drive Exotiq.`,
    openGraph: {
      title: `${vehicle.name} | Drive Exotiq`,
      description: `From ${formatMoney(vehicle.dailyRateCents)}/day. ${operator.city}, ${operator.state}.`,
      images: [vehicle.heroImage],
    },
  };
}

export default function VehicleRoute({ params }: Props) {
  return <div className={driveFontClassName}><VehicleEntryPage operatorSlug={params.operatorSlug} vehicleSlug={params.vehicleSlug} /></div>;
}
