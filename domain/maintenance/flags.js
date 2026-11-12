// Maintenance wall: the one reader of MAINTENANCE_MODE (MP-37).
//
// The wall is decided when a build is made, not per request: next.config.js calls readWall() and,
// when the wall is on, makes middleware.wall.ts the build's middleware. A normal build compiles no
// middleware at all. CommonJS so next.config.js can require it; the build tripwire
// (scripts/maintenance/assert-build.mjs) uses isWallOn.

/** On means the value, trimmed and lower-cased, is exactly on, true or 1. Anything else is off. */
function isWallOn(value) {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v === 'on' || v === 'true' || v === '1';
}

/**
 * True while `next build` runs: in the `next build` process itself (its arguments), or in a worker
 * that Next starts during the build (Next sets NEXT_PHASE to phase-production-build there). Not
 * for `next start`, `next dev`, `next lint` or a deployed server, which also read next.config.js.
 */
function isBuilding(env, argv) {
  if (env.NEXT_PHASE === 'phase-production-build') return true;
  const script = typeof argv[1] === 'string' ? argv[1] : '';
  return argv[2] === 'build' && /(^|[\\/])next(\.c?js|\.mjs)?$/.test(script);
}

/**
 * Reads the wall variables. During a build it prints one build-log line saying which build this
 * is; anywhere else it prints nothing, because a running server reads the variables from its own
 * environment and its answer would not describe the build it serves. Returns the decision and the
 * two optional values (strings, '' when unset) that next.config.js hands to the middleware bundle.
 */
function readWall(env = process.env, argv = process.argv) {
  const on = isWallOn(env.MAINTENANCE_MODE);
  if (isBuilding(env, argv)) console.log(`[maintenance] wall build: ${on ? 'ON' : 'OFF'}`);
  return {
    on,
    env: {
      MAINTENANCE_RETRY_AFTER: typeof env.MAINTENANCE_RETRY_AFTER === 'string' ? env.MAINTENANCE_RETRY_AFTER : '',
      MAINTENANCE_BACK_BY: typeof env.MAINTENANCE_BACK_BY === 'string' ? env.MAINTENANCE_BACK_BY : '',
    },
  };
}

module.exports = { isWallOn, readWall };
