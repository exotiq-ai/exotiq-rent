import type { MetadataRoute } from 'next';
import { robotsPolicy } from '@/domain/booking/seo';

export default function robots(): MetadataRoute.Robots {
  return robotsPolicy();
}
