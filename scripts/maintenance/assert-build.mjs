#!/usr/bin/env node
// Maintenance wall build tripwire (MP-37). Runs after `next build` (package.json postbuild) in the
// directory that holds .next. It compares what the build was asked for (MAINTENANCE_MODE in the
// build's environment, read through domain/maintenance/flags.js) with what was built, and fails the
// build when they disagree, so a deploy meant to be a wall can never quietly serve the normal site,
// and a normal deploy can never quietly serve the wall.
//
// "The wall was built" means: the middleware manifest lists a middleware, and one of the files it
// lists contains the wall's marker header name. A header name is a string literal, so it survives
// minification, and following the manifest's own file list does not depend on where Next puts the
// bundle. A middleware without the marker is some other middleware: fine for a normal build, a
// failure for a wall build.
//
// It also reads the app routes manifest. A wall build must be an app that holds nothing but the
// wall: the catch-all route app/[[...wall]] plus, at most, the static icon files and Next's own
// not-found page. Any other route there means the real app is still behind the wall, which a host
// could reach past the middleware. A normal build must not hold the catch-all.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { isWallOn } = require('../../domain/maintenance/flags.js');

const NEXT_DIR = path.join(process.cwd(), '.next');
const MANIFEST = '.next/server/middleware-manifest.json';
const MARKER = 'x-exotiq-maintenance';
const APP_ROUTES = '.next/app-path-routes-manifest.json';
const CATCH_ALL = '/[[...wall]]';
/** Routes a wall build may hold besides the catch-all: the static icon files and Next's not-found page. */
const WALL_BUILD_EXTRA_ROUTES = ['/apple-icon.png', '/favicon.ico', '/icon.svg', '/_not-found'];

function fail(sentence) {
  console.error(`[maintenance] tripwire failed: ${sentence}`);
  process.exit(1);
}
const unreadable = (what) => fail(`${what} is missing or unreadable, so this build cannot be checked.`);

let manifest;
try {
  manifest = JSON.parse(readFileSync(path.join(process.cwd(), MANIFEST), 'utf8'));
} catch {
  manifest = null;
}
if (!manifest || typeof manifest.middleware !== 'object' || manifest.middleware === null) unreadable(MANIFEST);

const entries = Object.values(manifest.middleware);
let wallBuilt = false;
for (const entry of entries) {
  for (const rel of Array.isArray(entry?.files) ? entry.files : []) {
    let text;
    try {
      text = readFileSync(path.join(NEXT_DIR, rel), 'utf8');
    } catch {
      unreadable(`.next/${rel} (listed in the middleware manifest)`);
    }
    if (text.toLowerCase().includes(MARKER)) wallBuilt = true;
  }
}
const otherBuilt = entries.length > 0 && !wallBuilt;
const wanted = isWallOn(process.env.MAINTENANCE_MODE);

let appRoutes = null;
try {
  const m = JSON.parse(readFileSync(path.join(process.cwd(), APP_ROUTES), 'utf8'));
  if (m && typeof m === 'object' && !Array.isArray(m)) appRoutes = Object.values(m);
} catch {
  appRoutes = null;
}
if (!appRoutes || appRoutes.some((r) => typeof r !== 'string')) unreadable(APP_ROUTES);
const hasCatchAll = appRoutes.includes(CATCH_ALL);
const appLeft = appRoutes.filter((r) => r !== CATCH_ALL && !WALL_BUILD_EXTRA_ROUTES.includes(r));

if (wanted && entries.length === 0) fail('MAINTENANCE_MODE asks for the wall but this build has no middleware, so it would serve the normal site.');
if (wanted && otherBuilt) fail('MAINTENANCE_MODE asks for the wall but the middleware in this build is not the wall, so it would not serve the wall page.');
if (wanted && !hasCatchAll) fail('MAINTENANCE_MODE asks for the wall but this build has no wall catch-all route, so a request handed past the middleware would reach no wall.');
if (wanted && appLeft.length) fail(`this wall build still contains application routes (${appLeft.join(', ')}), so the app behind the wall could still answer.`);
if (!wanted && wallBuilt) fail('this build contains the wall middleware but MAINTENANCE_MODE does not ask for the wall, so it would serve the wall instead of the normal site.');
if (!wanted && hasCatchAll) fail("this build contains the wall's catch-all route but MAINTENANCE_MODE does not ask for the wall, so it would serve the wall instead of the normal site.");

if (wanted) console.log('[maintenance] tripwire ok: the wall was wanted, and the wall middleware and the wall-only app were built.');
else if (otherBuilt) console.log('[maintenance] tripwire ok: the wall was not wanted and is not in this build; a non-wall middleware is present.');
else console.log('[maintenance] tripwire ok: the wall was not wanted and no middleware was built.');
