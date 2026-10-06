import type { MetadataRoute } from 'next';
import { tone } from '../components/browse/tokens';

/**
 * Minimal web manifest (MP-18): gives Android home-screen and add-to-home-screen icons something
 * to resolve. `display` stays 'browser': no install prompt (installability is out of scope).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Drive Exotiq',
    short_name: 'Drive Exotiq',
    display: 'browser',
    theme_color: tone.ground,
    background_color: tone.ground,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
