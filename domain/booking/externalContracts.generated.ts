// GENERATED canonical backend schema/validator; do not edit by hand.
// Source: supabase/functions/_shared/external-booking/contracts.ts
// Source SHA256: 28ddb0bd09fb2f225959e80ee744ff72c9e55b4dce69ceec4f96cab330e298b6
// Generator: scripts/generate-external-contracts.mjs; server-only section excluded; 0n -> BigInt(0).
/** Canonical transport-independent v1 schemas. OpenAPI and adapters consume these.
 * JSON Schema 2020-12: https://json-schema.org/draft/2020-12/json-schema-validation
 * OpenAPI: https://spec.openapis.org/oas/v3.1.2.html
 * Cross-field invariants additionally require validateContract; format annotations
 * alone do not enforce timezone, quote arithmetic, visibility or authorization.
 * Source writer is create_marketplace_booking; applied overload/ACL parity remains gated.
 */
export interface JsonSchema {
  type?: string; properties?: Record<string, JsonSchema>; required?: readonly string[];
  additionalProperties?: boolean; items?: JsonSchema; minItems?: number; maxItems?: number;
  uniqueItems?: boolean; minLength?: number; maxLength?: number; pattern?: string;
  format?: string; minimum?: number; maximum?: number; enum?: readonly unknown[];
  const?: unknown; anyOf?: readonly JsonSchema[]; oneOf?: readonly JsonSchema[];
  description?: string; default?: unknown;
}
const text = (maxLength: number, minLength = 1): JsonSchema => ({ type: 'string', minLength, maxLength });
const enumeration = (...values: string[]): JsonSchema => ({ type: 'string', enum: values });
const integer = (maximum = Number.MAX_SAFE_INTEGER, minimum = 0): JsonSchema => ({ type: 'integer', minimum, maximum });
const object = (properties: Record<string, JsonSchema>, optional: string[] = []): JsonSchema => ({ type: 'object', properties, required: Object.keys(properties).filter((key) => !optional.includes(key)), additionalProperties: false });
const array = (items: JsonSchema, maxItems: number, minItems = 0): JsonSchema => ({ type: 'array', items, maxItems, minItems });
const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] });
const timestamp: JsonSchema = { ...text(35), format: 'date-time', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$' };
const uuid: JsonSchema = { ...text(36, 36), format: 'uuid' };
const httpsUrl: JsonSchema = { ...text(2048), format: 'https-url', pattern: '^https://' };
const cursor: JsonSchema = { ...text(2048), pattern: '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$' };
const slug: JsonSchema = { ...text(80), pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' };
const metadata = { api_version: { const: 'v1' }, source_checked_at: timestamp };
const rentalWindow = { operator_id: uuid, vehicle_id: uuid, pickup_at: timestamp, return_at: timestamp, timezone: { ...text(80), format: 'iana-timezone' } };
const options: JsonSchema = { ...array(enumeration('premium', 'standard', 'decline'), 1, 1), uniqueItems: true, description: 'Current backend protection IDs. No unrecognized add-ons or client amounts.' };
// Exact latest source bookings_status_check: 20260724015013_c1c8f150-*.sql.
// Payment expiry stores payment_expired; unverified/request hold expiry stores
// cancelled plus cancellation_reason. Generic 'expired' is not a stored booking state.
export const BACKEND_STATUSES = ['pending_documents', 'requested', 'pending', 'pending_payment', 'confirmed', 'active', 'declined', 'cancelled', 'payment_expired', 'completed', 'refunded'] as const;
export const NEXT_ACTIONS = ['verify_identity', 'await_operator', 'hosted_checkout', 'await_payment_settlement', 'await_reconciliation', 'confirmed', 'rental_active', 'declined', 'cancelled', 'expired', 'completed', 'refunded', 'recover_authorization'] as const;
export const ERROR_CODES = ['invalid_input', 'unauthorized', 'forbidden', 'not_found', 'dates_unavailable', 'quote_changed', 'idempotency_conflict', 'request_in_flight', 'consent_mismatch', 'quote_expired', 'consent_expired', 'payment_window_expired', 'rate_limited', 'upstream_unavailable'] as const;
export const SCOPES = ['catalog:read', 'quotes:create', 'rental_requests:create', 'rental_requests:read', 'checkout:handoff'] as const;
export const OperatorsQuery = object({ city: text(80), operator_slug: slug, cursor, limit: { ...integer(50, 1), default: 20 } }, ['city', 'operator_slug', 'cursor', 'limit']);
export const VehiclesQuery = object({ operator_id: uuid, city: text(80), cursor, limit: { ...integer(50, 1), default: 20 }, pickup_at: timestamp, return_at: timestamp, timezone: rentalWindow.timezone }, ['operator_id', 'city', 'cursor', 'limit', 'pickup_at', 'return_at', 'timezone']);
export const Operator = object({ operator_id: uuid, slug, name: text(160), city: text(80), timezone: rentalWindow.timezone, storefront_url: httpsUrl });
export const Vehicle = object({ operator_id: uuid, vehicle_id: uuid, slug, name: text(160), city: text(80), timezone: rentalWindow.timezone, vehicle_url: httpsUrl, availability_requires_check: { const: true } });
export const OperatorsPage = object({ ...metadata, items: array(Operator, 50), next_cursor: nullable(cursor) });
export const VehiclesPage = object({ ...metadata, items: array(Vehicle, 50), next_cursor: nullable(cursor) });
export const AvailabilityRequest = object(rentalWindow);
export const AvailabilityResult: JsonSchema = { oneOf: [
  object({ ...metadata, ...rentalWindow, availability: enumeration('AVAILABLE', 'UNAVAILABLE'), buffer_policy_version: text(128) }),
  object({ ...metadata, ...rentalWindow, availability: { const: 'UNKNOWN' }, buffer_policy_version: { type:'null' }, reason_code: enumeration('upstream_unavailable'), retry_after_seconds: integer(3600, 1) }),
] };
export const QuoteRequest = object({ ...rentalWindow, selected_options: options });
export const QuoteItemization = object({ rental_subtotal_cents: integer(), operator_tax_cents: integer(), operator_tax_inclusive: { type: 'boolean' }, platform_fee_cents: integer(), protection_total_cents: integer(), state_fee_cents: integer(), processing_fee_cents: integer(), deposit_cents: { ...integer(), description: 'Separate security deposit disclosure; excluded from both rental charge totals. No card authorization is created by quoting.' } });
export const PaymentScheduleItem = object({ payee: enumeration('operator', 'exotiq'), amount_cents: integer(), due: enumeration('after_operator_approval', 'after_operator_charge') });
// Customer-visible disclosures are data from server authority, never inferred by MCP.
const decimalAmount: JsonSchema = { ...text(24), pattern: '^(?:0|[1-9]\\d{0,12})(?:\\.\\d{1,8})?$' };
export const QuoteTerms = object({ cancellation_policy: text(8000), pickup_address: nullable(text(4096)), pickup_instructions: nullable(text(4096)), mileage_limit: nullable(integer()), mileage_overage_rate_usd: nullable(decimalAmount), deposit_disclosure: text(2000) });
export const QuotePricingDetails = object({ rental_days: integer(365, 1), daily_rate_cents: integer(), protection_tier: enumeration('premium', 'standard', 'decline'), protection_daily_cents: integer(), state_code: { ...text(2, 2), pattern: '^[A-Z]{2}$' }, state_fee_label: text(160), state_fee_daily_cents: integer(), operator_tax_label: text(160), operator_tax_rate_percent: decimalAmount, platform_fee_percent: decimalAmount });
export const QuoteResult = object({ ...metadata, ...rentalWindow, quote_id: uuid, principal_scope: object({ subject: text(256), operator_id: uuid }), expires_at: timestamp, pricing_version: text(128), terms_version: text(128), terms_hash: { ...text(64, 64), pattern: '^[a-f0-9]{64}$' }, selected_options: options, terms: QuoteTerms, pricing_details: QuotePricingDetails, currency: { ...text(3, 3), enum: ['USD'], description: 'ISO 4217 currency. v1 supports USD only; adding a currency requires backend charge-leg and rounding proof.' }, itemization: QuoteItemization, operator_total_cents: integer(), exotiq_total_cents: integer(), total_cents: integer(), payment_schedule: array(PaymentScheduleItem, 2, 2), availability_checked_at: timestamp, holds_inventory: { const: false }, consent_url: httpsUrl });
export const RentalRequestInput = object({ quote_id: uuid, consent_receipt_id: uuid });
export const ScopedLinks = object({ status: httpsUrl, consent: httpsUrl, recovery: httpsUrl, identity: httpsUrl, checkout_handoff: httpsUrl }, ['consent', 'recovery', 'identity', 'checkout_handoff']);
export const RentalRequestResult = object({ ...metadata, ref: { ...text(80), pattern: '^[A-Za-z0-9_-]+$' }, status: enumeration(...BACKEND_STATUSES), next_action: enumeration(...NEXT_ACTIONS), hold_expires_at: nullable(timestamp), links: ScopedLinks });
export const RentalStatusResult = object({ ...RentalRequestResult.properties, payment_due_at: nullable(timestamp), inventory_blocked: { type: 'boolean' }, poll_after_seconds: integer(3600, 1) });
export const CheckoutHandoffResult = object({ ...metadata, customer_url: httpsUrl, expires_at: timestamp, state: enumeration('pending_payment'), next_action: enumeration('hosted_checkout') });
export const ConsentResult = object({ ...metadata, quote_id: uuid, state: enumeration('waiting', 'authorized'), consent_receipt_id: uuid, expires_at: timestamp }, ['consent_receipt_id', 'expires_at']);
export const RecoveryResult = object({ ...metadata, ref: text(80), state: enumeration('authorization_required', 'authorized'), customer_url: httpsUrl, expires_at: timestamp });
export const ConsentInput = object({terms_hash:{...text(64,64),pattern: "^[a-f0-9]{64}$"},action:{const:"rental_requests:create"}});
export const CustomerConsentResult = object({...metadata,quote_id:uuid,state:{const:"authorized"},expires_at:timestamp});
export const QuoteReviewResult = object({quote:QuoteResult,operator_name:text(160),vehicle_name:text(160),agent_client_id:text(512)});
export const CustomerOperatorLinkInput = object({operator_id:uuid,full_name:text(160,2),phone:{...text(30,7),pattern:"^[+0-9() .-]{7,30}$"},consented:{const:true}});
export const CustomerOperatorLinkResult = object({...metadata,operator_id:uuid,state:{const:"linked"}});
const grantScopes:JsonSchema={...array(enumeration("rental_requests:read","checkout:handoff"),2,1),uniqueItems:true};
export const GrantRenewalInput = object({grant_id:uuid});
export const GrantRenewalReviewInput = object({});
export const GrantRenewalCompleteInput = object({action_scopes:grantScopes,explicit_new_delegation:{type:"boolean"},consented:{const:true}});
export const GrantRenewalReviewResult = object({...metadata,renewal_id:uuid,previous_grant_id:uuid,grant_id_to_revoke:uuid,ref:text(80),operator_id:uuid,agent_client_id:text(512),operator_name:text(160),vehicle_name:text(160),pickup_at:timestamp,return_at:timestamp,timezone:rentalWindow.timezone,status:enumeration(...BACKEND_STATUSES),hold_expires_at:nullable(timestamp),payment_due_at:nullable(timestamp),action_scopes:grantScopes,expires_at:timestamp,state:enumeration("authorization_required","authorized"),requires_new_delegation:{type:"boolean"}});
export const GrantRenewalResult = object({...metadata,renewal_id:uuid,state:enumeration("authorization_required","authorized"),customer_url:httpsUrl,expires_at:timestamp,grant_id:uuid},["grant_id"]);
export const ApiError = object({ code: enumeration(...ERROR_CODES), message: text(200), request_id: { ...text(80, 16), pattern: '^[A-Za-z0-9_-]+$' }, retryable: { type: 'boolean' }, details: object({ retry_after_seconds: integer(3600, 1), field: enumeration('operator_id', 'vehicle_id', 'pickup_at', 'return_at', 'timezone', 'quote_id', 'consent_receipt_id', 'selected_options', 'cursor', 'limit', 'Idempotency-Key') }, ['retry_after_seconds', 'field']) }, ['details']);
export const schemas = { OperatorsQuery, VehiclesQuery, Operator, Vehicle, OperatorsPage, VehiclesPage, AvailabilityRequest, AvailabilityResult, QuoteRequest, QuoteItemization, PaymentScheduleItem, QuoteTerms, QuotePricingDetails, QuoteResult, RentalRequestInput, ScopedLinks, RentalRequestResult, RentalStatusResult, CheckoutHandoffResult, ConsentResult, RecoveryResult, ConsentInput, CustomerConsentResult, QuoteReviewResult, CustomerOperatorLinkInput, CustomerOperatorLinkResult, GrantRenewalInput, GrantRenewalReviewInput, GrantRenewalCompleteInput, GrantRenewalReviewResult, GrantRenewalResult, ApiError };
export type ContractName = keyof typeof schemas;
export type ValidationResult = { ok: true } | { ok: false; issues: string[] };
type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTimestamp(value: string): { instant: number; wall: number; offset: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[8] === '-00:00') return null;
  const [, y, m, d, h, min, sec, fraction = '', zone] = match;
  const numbers = [y, m, d, h, min, sec].map(Number);
  if (numbers[0] < 2000 || numbers[0] > 9999 || numbers[1] < 1 || numbers[1] > 12 || numbers[2] < 1 || numbers[2] > 31 || numbers[3] > 23 || numbers[4] > 59 || numbers[5] > 59) return null;
  const wall = Date.UTC(numbers[0], numbers[1] - 1, numbers[2], numbers[3], numbers[4], numbers[5], Number(fraction.padEnd(3, '0')));
  const date = new Date(wall);
  if (date.getUTCMonth() !== numbers[1] - 1 || date.getUTCDate() !== numbers[2]) return null;
  const offset = zone === 'Z' ? 0 : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 14 || Number(zone.slice(4, 6)) > 59 || Math.abs(offset) > 840)) return null;
  return { instant: wall - offset * 60000, wall, offset };
}
export function timestampInstant(value: string): number | null { return parseTimestamp(value)?.instant ?? null; }
function validTimezone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; }
}
function zonedWall(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second) + ((instant % 1000) + 1000) % 1000;
}
function validFormat(format: string, value: string): boolean {
  if (format === 'uuid') return uuidPattern.test(value);
  if (format === 'date-time') return parseTimestamp(value) !== null;
  if (format === 'iana-timezone') return validTimezone(value);
  if (format === 'https-url') {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !/[?&](?:t|token|confirmation_token|access_token)=/i.test(url.search); } catch { return false; }
  }
  throw new Error(`Unsupported contract format: ${format}`);
}
/** Validator for exactly the JSON Schema vocabulary used by the canonical schemas.
 * New keywords must be implemented here before adoption; do not silently ignore them.
 * Issues expose field paths only, never caller values or sensitive exception text.
 */
function schemaIssues(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const vocabulary = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'enum', 'const', 'anyOf', 'oneOf', 'description', 'default']);
  for (const key of Object.keys(schema)) if (!vocabulary.has(key)) throw new Error(`Unsupported contract keyword: ${key}`);
  if (schema.type && !['null', 'boolean', 'integer', 'string', 'array', 'object'].includes(schema.type)) throw new Error(`Unsupported contract type: ${schema.type}`);
  if (schema.anyOf) return schema.anyOf.some((branch) => !schemaIssues(branch, value, path).length) ? [] : [path];
  if (schema.oneOf) return schema.oneOf.filter((branch) => !schemaIssues(branch, value, path).length).length === 1 ? [] : [path];
  if ('const' in schema && value !== schema.const) return [path];
  if (schema.enum && !schema.enum.includes(value)) return [path];
  if (schema.type === 'null') return value === null ? [] : [path];
  if (schema.type === 'boolean') return typeof value === 'boolean' ? [] : [path];
  if (schema.type === 'integer') return typeof value === 'number' && Number.isSafeInteger(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity) ? [] : [path];
  if (schema.type === 'string') return typeof value === 'string' && Array.from(value).length >= (schema.minLength ?? 0) && Array.from(value).length <= (schema.maxLength ?? Infinity) && (!schema.pattern || new RegExp(schema.pattern).test(value)) && (!schema.format || validFormat(schema.format, value)) ? [] : [path];
  if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity) || (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length)) return [path];
    return value.flatMap((item, i) => schemaIssues(schema.items!, item, `${path}[${i}]`));
  }
  if (schema.type === 'object') {
    if (!isObject(value)) return [path];
    const missing = (schema.required ?? []).filter((key) => !Object.hasOwn(value, key)).map((key) => `${path}.${key}`);
    // Do not echo attacker-controlled unexpected property names.
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties!, key))) missing.push(path);
    return [...missing, ...Object.keys(schema.properties ?? {}).filter((key) => Object.hasOwn(value, key)).flatMap((key) => schemaIssues(schema.properties![key], value[key], `${path}.${key}`))];
  }
  return [];
}
/** Half-open interval [pickup,return), explicit offset must match tenant wall-clock.
 * The source availability reader caps its range at start + one calendar year;
 * v1 conservatively caps duration to 365 days. Source writer has no maximum
 * rental duration; this bound is a new contract safeguard, not a deployed claim.
 * Caller supplies authoritative tenantTimezone and request clock when validating writes.
 */
export function validateRentalWindow(value: { pickup_at: string; return_at: string; timezone: string }, context: { now?: number; tenantTimezone?: string; maxDurationDays?: number } = {}): ValidationResult {
  const start = parseTimestamp(value.pickup_at), end = parseTimestamp(value.return_at);
  if (!start || !end || !validTimezone(value.timezone) || (context.tenantTimezone !== undefined && context.tenantTimezone !== value.timezone)) return { ok: false, issues: ['$.timezone'] };
  if (zonedWall(start.instant, value.timezone) !== start.wall || zonedWall(end.instant, value.timezone) !== end.wall) return { ok: false, issues: ['$.pickup_at', '$.return_at'] };
  // Existing public_vehicle_quote bills distinct local calendar dates and rejects
  // same-day rentals. Do not advertise an interval its authority cannot quote.
  if (Math.floor(end.wall / 86400000) <= Math.floor(start.wall / 86400000) || end.instant <= start.instant || end.instant - start.instant > (context.maxDurationDays ?? 365) * 86400000 || (context.now !== undefined && start.instant < context.now)) return { ok: false, issues: ['$.pickup_at', '$.return_at'] };
  return { ok: true };
}
export function validateContract(name: ContractName, value: unknown, context: { now?: number; tenantTimezone?: string } = {}): ValidationResult {
  const issues = schemaIssues(schemas[name], value);
  if (issues.length) return { ok: false, issues };
  if (isObject(value)) {
    if (['AvailabilityRequest', 'AvailabilityResult', 'QuoteRequest', 'QuoteResult'].includes(name) || (name === 'VehiclesQuery' && ('pickup_at' in value || 'return_at' in value || 'timezone' in value))) {
      if (!['pickup_at', 'return_at', 'timezone'].every((key) => typeof value[key] === 'string')) issues.push('$.pickup_at', '$.return_at', '$.timezone');
      else {
        const result = validateRentalWindow(value as { pickup_at: string; return_at: string; timezone: string }, context);
        if (result.ok === false) issues.push(...result.issues);
      }
    }
    if (name === 'QuoteResult') {
      const item = value.itemization as Record<string, number | boolean>;
      const details = value.pricing_details as Record<string, number | string>;
      const days = BigInt(details.rental_days as number);
      if (days * BigInt(details.daily_rate_cents as number) !== BigInt(item.rental_subtotal_cents as number) || days * BigInt(details.protection_daily_cents as number) !== BigInt(item.protection_total_cents as number) || days * BigInt(details.state_fee_daily_cents as number) !== BigInt(item.state_fee_cents as number) || details.protection_tier !== (value.selected_options as string[])[0]) issues.push('$.pricing_details');
      const operator = BigInt(item.rental_subtotal_cents as number) + (item.operator_tax_inclusive ? BigInt(0) : BigInt(item.operator_tax_cents as number));
      const exotiq = ['platform_fee_cents', 'protection_total_cents', 'state_fee_cents', 'processing_fee_cents'].reduce((sum, key) => sum + BigInt(item[key] as number), BigInt(0));
      if (operator !== BigInt(value.operator_total_cents as number) || exotiq !== BigInt(value.exotiq_total_cents as number) || operator + exotiq !== BigInt(value.total_cents as number) || (item.operator_tax_inclusive && (item.operator_tax_cents as number) > (item.rental_subtotal_cents as number))) issues.push('$.itemization');
      const schedule = value.payment_schedule as { payee: string; amount_cents: number; due: string }[];
      if (schedule.filter((leg) => leg.payee === 'operator' && BigInt(leg.amount_cents) === operator && leg.due === 'after_operator_approval').length !== 1 || schedule.filter((leg) => leg.payee === 'exotiq' && BigInt(leg.amount_cents) === exotiq && leg.due === 'after_operator_charge').length !== 1) issues.push('$.payment_schedule');
      if ((value.principal_scope as JsonObject).operator_id !== value.operator_id) issues.push('$.principal_scope');
      const checked = Date.parse(value.source_checked_at as string), expires = Date.parse(value.expires_at as string), available = Date.parse(value.availability_checked_at as string);
      if (expires <= checked || available > checked || (context.now !== undefined && (expires <= context.now || checked > context.now))) issues.push('$.expires_at');
    }
    if (name === 'QuoteReviewResult' && !validateContract('QuoteResult',value.quote,context).ok) issues.push('$.quote');
    if (name === 'ConsentResult' && (value.state === 'authorized' ? !value.consent_receipt_id || !value.expires_at : value.consent_receipt_id !== undefined || !value.expires_at)) issues.push('$.state');
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}
