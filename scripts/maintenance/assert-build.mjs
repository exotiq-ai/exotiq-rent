#!/usr/bin/env node
// Maintenance wall build tripwire (MP-37). Runs after `next build` (package.json postbuild) in the
// directory that holds .next. It compares what the build was asked for (MAINTENANCE_MODE, read
// through domain/maintenance/flags.js) with what was built (.next/server/middleware-manifest.json)
// and fails the build when they disagree in either direction, so a deploy meant to be a wall can
// never quietly serve the normal site, and a normal deploy can never quietly serve the wall.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { isWallOn } = require('../../domain/maintenance/flags.js');

const MANIFEST = path.join('.next', 'server', 'middleware-manifest.json');

function fail(sentence) {
  console.error(`[maintenance] tripwire failed: ${sentence}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(path.join(process.cwd(), MANIFEST), 'utf8'));
} catch {
  manifest = null;
}
if (!manifest || typeof manifest.middleware !== 'object' || manifest.middleware === null) {
  fail(`${MANIFEST.split(path.sep).join('/')} is missing or unreadable, so this build cannot be checked.`);
}

const wanted = isWallOn(process.env.MAINTENANCE_MODE);
const built = Object.keys(manifest.middleware).length > 0;

if (wanted && !built) fail('MAINTENANCE_MODE asks for the wall but this build has no middleware, so it would serve the normal site.');
if (!wanted && built) fail('this build has a middleware but MAINTENANCE_MODE does not ask for the wall, so it would not serve the normal site.');
console.log(
  wanted
    ? '[maintenance] tripwire ok: the wall was wanted and a middleware was built.'
    : '[maintenance] tripwire ok: the wall was not wanted and no middleware was built.',
);
