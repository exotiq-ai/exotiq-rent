// Maintenance wall middleware (MP-37). Inert in a normal build: Next only treats this file as the
// middleware when next.config.js puts 'wall.ts' first in pageExtensions, which it does only for a
// wall build (see domain/maintenance/flags.js). There is deliberately no matcher, so it answers
// every path.
import { buildWallResponse } from '@/domain/maintenance/wall';

export function middleware(request: Request) {
  return buildWallResponse(request);
}
