import type { Metadata } from 'next';
import { VehicleEntryPage } from '@/components/drive-exotiq/VehicleEntryPage';
import { driveFontClassName } from '@/components/drive-exotiq/fonts';
import { getPublicVehicleContext } from '@/domain/booking/service';
import { formatMoney } from '@/domain/booking/totals';

type Props = { params: { operatorSlug: string; vehicleSlug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const teamSlug = params.operatorSlug;
  const result = await getPublicVehicleContext(teamSlug, params.vehicleSlug);
  if (!result) return { title: 'Vehicle not found | Drive Exotiq' };
  const { team, vehicle } = result;
  return {
    title: `${vehicle.name} | ${team.name} | Drive Exotiq`,
    description: `From ${formatMoney(vehicle.dailyRateCents)}/day. ${team.city}, ${team.state}. Book with Drive Exotiq.`,
    openGraph: {
      title: `${vehicle.name} | Drive Exotiq`,
      description: `From ${formatMoney(vehicle.dailyRateCents)}/day. ${team.city}, ${team.state}.`,
      images: [vehicle.heroImage],
    },
  };
}

export default async function VehicleRoute({ params }: Props) {
  return <div className={driveFontClassName}>{await VehicleEntryPage({ operatorSlug: params.operatorSlug, vehicleSlug: params.vehicleSlug })}</div>;
}
