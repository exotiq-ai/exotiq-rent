# Agents

## Cursor Cloud specific instructions

This is a Next.js 14 luxury car rental marketplace (Exotiq Rent / Drive Exotiq). It is a frontend-only app with all data hardcoded in `components/marketplace/data.ts`. There is no database or external API.

### Running the app

- **Dev server:** `npm run dev` (port 3000)
- **Lint:** `npm run lint`
- **Build:** `npm run build`

### Password gate

The app is protected by a password gate middleware. Default password is `exotiq2026` (configurable via `SITE_PASSWORD` env var). When testing in the browser, you must enter this password at `/gate` before accessing the main app.

### Routing

The app uses client-side hash-based routing (`/#search`, `/#vehicle/1`, `/#booking`, etc.), not Next.js file-system routes. Only `/`, `/gate`, and `/api/auth` are server-side routes.

### No test framework

There is no test framework configured. Lint (`npm run lint`) and build (`npm run build`) are the primary automated checks.
