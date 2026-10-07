import { validateContract } from './externalContracts.generated';
export const ownedUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export interface ExternalQuote {
  api_version: 'v1'; quote_id: string; operator_id: string; vehicle_id: string;
  pickup_at: string; return_at: string; timezone: string; expires_at: string;
  terms_hash: string; pricing_version: string; terms_version: string; currency: 'USD';
  selected_options: string[]; holds_inventory: false; availability_checked_at: string;
  terms: { cancellation_policy: string; pickup_address: string | null; pickup_instructions: string | null; mileage_limit: number | null; mileage_overage_rate_usd: string | null; deposit_disclosure: string };
  pricing_details: { rental_days: number; daily_rate_cents: number; protection_tier: string; protection_daily_cents: number; state_code: string; state_fee_label: string; state_fee_daily_cents: number; operator_tax_label: string; operator_tax_rate_percent: string; platform_fee_percent: string };
  itemization: { rental_subtotal_cents: number; operator_tax_cents: number; operator_tax_inclusive: boolean; platform_fee_cents: number; protection_total_cents: number; state_fee_cents: number; processing_fee_cents: number; deposit_cents: number };
  operator_total_cents: number; exotiq_total_cents: number; total_cents: number;
  payment_schedule: { payee: 'operator' | 'exotiq'; amount_cents: number; due: 'after_operator_approval' | 'after_operator_charge' }[];
}
export interface QuoteReview { quote: ExternalQuote; operator_name: string; vehicle_name: string; agent_client_id: string }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export function parseQuoteReview(value: unknown, quoteId: string, now = Date.now()): QuoteReview {
  if (!record(value) || Object.keys(value).some((key) => !['quote', 'operator_name', 'vehicle_name', 'agent_client_id'].includes(key)) ||
    !['operator_name', 'vehicle_name', 'agent_client_id'].every((key) => typeof value[key] === 'string' && (value[key] as string).length > 0 && (value[key] as string).length <= 512) ||
    !validateContract('QuoteResult', value.quote, { now }).ok || !record(value.quote) || value.quote.quote_id !== quoteId) throw Error('The complete rental terms could not be confirmed. Request a fresh quote from your agent.');
  return value as unknown as QuoteReview;
}

export type CustomerSession = { authenticated: true; csrf: string; expires_at: string; profile: { email: string | null; emailVerified: boolean; name: string | null } };
export function parseCustomerSession(value: unknown, now = Date.now()): CustomerSession | null {
  if (!record(value) || value.authenticated !== true || typeof value.csrf !== 'string' || value.csrf.length < 8 || value.csrf.length > 128 || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= now || !record(value.profile) || typeof value.profile.emailVerified !== 'boolean' || !(value.profile.email === null || typeof value.profile.email === 'string') || !(value.profile.name === null || typeof value.profile.name === 'string')) return null;
  return value as CustomerSession;
}
