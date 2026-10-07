import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sourcePath = process.argv[2];
if (!sourcePath) throw Error('Pass the reviewed canonical backend contracts.ts path.');
const source = readFileSync(sourcePath, 'utf8');
const sha = createHash('sha256').update(source).digest('hex');
// The browser consumes exactly the schema/validation section. Server cursor
// signing and OpenAPI generation are excluded. BigInt(0) preserves arithmetic
// while supporting the existing frontend TypeScript target.
const boundary = source.indexOf('export function validateIdempotencyKey');
if (boundary < 0) throw Error('Canonical validation boundary changed; review the generator.');
const generated = source.slice(0, boundary).replace(/\b0n\b/g, 'BigInt(0)');
const artifact = `// GENERATED canonical backend schema/validator; do not edit by hand.\n// Source: supabase/functions/_shared/external-booking/contracts.ts\n// Source SHA256: ${sha}\n// Generator: scripts/generate-external-contracts.mjs; server-only section excluded; 0n -> BigInt(0).\n${generated}`;
if (process.argv.includes('--check')) {
  if (readFileSync('domain/booking/externalContracts.generated.ts', 'utf8') !== artifact) throw Error('Canonical frontend contracts drifted; regenerate from the reviewed backend source.');
} else writeFileSync('domain/booking/externalContracts.generated.ts', artifact);
process.stdout.write(sha + '\n');
