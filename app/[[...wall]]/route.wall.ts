// Maintenance wall, origin layer (MP-37). A route only in a wall build: there pageExtensions are
// ['wall.ts', 'wall.tsx'], so this catch-all is the app's one route and answers every path and
// method with the wall, also for a request a host hands past the middleware. In a normal build this
// file's base name is not "route", so it is not a route and nothing changes.
import { buildWallResponse } from '@/domain/maintenance/wall';

export const dynamic = 'force-dynamic';

const wall = (request: Request) => buildWallResponse(request);

export const GET = wall;
export const HEAD = wall;
export const POST = wall;
export const PUT = wall;
export const PATCH = wall;
export const DELETE = wall;
export const OPTIONS = wall;
