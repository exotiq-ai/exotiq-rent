import { describe, expect, it } from 'vitest';
import { sanitizePostHogEvent } from '../../components/analytics/policy';

describe('real PostHog transport contract', () => {
  it('retains the public project token required by posthog-js ingestion, never private keys', () => {
    const publicEvent = sanitizePostHogEvent({ event: '$pageview', properties: { token: 'phc_validPublic123', distinct_id: '00000000-1234-4000-8000-000000000001', $current_url: 'https://book.exotiq.rent/exotiq' } });
    expect(publicEvent?.properties.token).toBe('phc_validPublic123');
    for (const token of ['phs_private123', 'phx_private123', 'booking-access-secret']) {
      expect(sanitizePostHogEvent({ event: '$pageview', properties: { token } })?.properties.token).toBeUndefined();
    }
  });

  it('keeps coarse device categories needed by the dashboard, not unrestricted device data', () => {
    expect(sanitizePostHogEvent({ event: '$pageview', properties: { $device_type: 'Mobile' } })?.properties.$device_type).toBe('Mobile');
    expect(sanitizePostHogEvent({ event: '$pageview', properties: { $device_type: 'renter@example.com' } })?.properties.$device_type).toBeUndefined();
  });
});
