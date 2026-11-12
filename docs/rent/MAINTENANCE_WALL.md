# Maintenance wall

The maintenance wall is a special build of this site that answers every request with
HTTP 503, a `Retry-After` header and a short Exotiq page saying booking is paused for planned
maintenance. Use it when renters must not be able to quote, book, pay, verify their ID or cancel
for a while. A normal build is not affected: it compiles no middleware and its config is the
same as without this feature.

## What a visitor gets

- Every path answers 503: pages, deep links, API routes, `robots.txt`, the sitemap, icons, static
  files and Next data requests. GET, HEAD, POST, PUT, PATCH, DELETE and OPTIONS all answer the
  wall. Odd requests such as TRACE or an over-long URL are refused by the server before the wall
  and reach no application code.
- On Netlify every path tried, including static files and the image paths, answered the wall; a
  plain `next start` server handles `/_next/image` before the wall.
- Headers: `Retry-After`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`,
  `X-Exotiq-Maintenance: on` and a content policy that lets the page load nothing from anywhere.
- Pages get a small HTML page that loads nothing else (no script, no image, no font, no other
  request). It tells people not to pay again if they just paid, and gives `support@exotiq.ai`
  for help with a current rental.
- API paths under `/api/` get a short JSON body
  `{"error":"Booking is paused for maintenance. Please try again later.","maintenance":true}`,
  unless the request asks for `text/html` (a confirm or unsubscribe link clicked in an e-mail):
  then it gets the same HTML page. Status and headers are the same either way.

## The three variables

All three are server side only and are read when a build is made, never by the browser. They only
count when they are in the build's environment (on Netlify: the site's or the context's
environment, or `netlify.toml`). An env file such as `.env.local` is not read by the tripwire,
so never set the wall there.

| Variable | Rule |
| --- | --- |
| `MAINTENANCE_MODE` | The wall is on only when the value, trimmed and in any case, is `on`, `true` or `1`. Anything else (unset, empty, `off`, `0`, `yes` ...) is a normal build. |
| `MAINTENANCE_RETRY_AFTER` | Seconds for the `Retry-After` header. A plain whole number from 60 to 86400 is used as is; anything else, or unset, gives 1800. |
| `MAINTENANCE_BACK_BY` | Optional text for one extra sentence, "We expect to be back by ...". Used only when it is 1 to 60 characters with no line break or other control character; otherwise it is ignored, never cut short. Unset by default, so the page promises no time. |

## Decided when a build is made

The wall is decided when the build is made, not per request. `next.config.js` asks
`domain/maintenance/flags.js`, and during the build it prints `[maintenance] wall build: ON` or
`[maintenance] wall build: OFF`. With the wall on, `middleware.wall.ts` becomes the middleware and
answers every request; with it off that file is ignored.

The build log's two lines are the record: the `wall build:` line and the tripwire line below. The
running site prints nothing about the wall (a server started from a build does not know how that
build was made), so check a running site with `check-wall.mjs`, never by its logs.

So a wall deploy is built once and then published to turn the wall on. The wall is per site: a
wall deploy exists per Netlify site (each site connected to the repo builds its own Deploy Preview
of the `maintenance-wall` pull request), so publish it on each site that should be walled.
The page text, `Retry-After` and the back-by text are fixed into that deploy. Changing any of them means a new
commit, a new deploy and a new check.

Builds of this site fetch fonts from Google, and that fetch occasionally fails a build, wall or
not. A failed build publishes nothing, which is one more reason the wall deploy is built and
checked well ahead of time.

After every build, `scripts/maintenance/assert-build.mjs` (the `postbuild` script) checks whether
the wall itself was built (the built middleware carries the wall's marker header) and fails the
build when that disagrees with the variable: the wall was asked for but no middleware, or a
middleware that is not the wall, was built; or the wall was built although it was not asked for.
A normal build that has some other middleware is fine. It prints `[maintenance] tripwire ok: ...`
when all is well. Look for that line in the deploy log. If it is missing, the site is building
with `next build` instead of `npm run build`, and the tripwire did not run.

## The `maintenance-wall` branch and its Deploy Preview

The `maintenance-wall` branch is this code plus one change to `netlify.toml` that sets
`MAINTENANCE_MODE = "on"` for Deploy Previews and branch deploys only. The production context is
deliberately absent, so merging that branch by mistake still could not wall production builds.
Its pull request is a draft marked "do not merge"; its Deploy Preview on the booking site is the
pre-built wall deploy. Keep that deploy (do not delete it), and do not push to the branch once the
wall deploy has been checked: a push makes a new deploy that has not been checked.

## Raising and lowering the wall

1. Before raising it, record the restore point: the id of the deploy that is published on the
   booking site right now.
2. Raise it: in Netlify, publish the wall deploy (the checked Deploy Preview of the
   `maintenance-wall` pull request). Publishing a deploy by hand locks auto publishing on that
   site. Then run the checker with `--expect on`.
3. Lower it: publish the normal deploy (the restore point recorded in step 1, or a newer normal
   deploy if one was planned), then unlock auto publishing. Then run the checker with
   `--expect off`.

Run the check after each publish step, not only once.

No variable on the production site is changed for any of this.

## Checking it

`scripts/maintenance/check-wall.mjs` requests a fixed list of pages, deep links, API routes,
metadata routes and static paths and prints one line per request.

```sh
node scripts/maintenance/check-wall.mjs https://book.exotiq.rent --expect on
node scripts/maintenance/check-wall.mjs https://book.exotiq.rent --expect off
```

- `--expect on` passes when every route answers 503 with `Retry-After` and
  `X-Exotiq-Maintenance: on`. The last line says `summary: expect on: ... all OK` and the exit
  code is 0.
- `--expect off` passes when no route carries the marker header or the wall page, and the four
  core pages every deployment serves (`/`, `/terms`, `/privacy`, `/robots.txt`) answer below
  400 (the 307 on `/` counts as an answer and is not followed).
  An off pass means the wall is gone and the four core pages answer.
  Other routes are not judged by status: some pages are switched off per site (they answer 404 by design), storefront pages depend on which tenant a
  site serves, and the e-mail capture route can answer 503 itself when it is not configured.
- It sends only requests that cannot write: GET and HEAD, plus one POST to the e-mail capture
  route with an empty `text/plain` body, which that route refuses before reading anything. It
  sends no token and talks to the one host it is given.
- A trailing slash path such as `/exotiq/` first answers a 308 redirect to `/exotiq` (the
  router does that before any middleware); the checker follows that one redirect and requires
  the wall behind it. The image optimizer path is shown with what it answered and never decides
  the result.

## What the wall does not stop

- A tab that was already open with a booking or payment form: the form talks to the booking
  backend directly from the browser. Raise the wall well ahead of time so open tabs go stale.
- The daily canary (`.github/workflows/canary.yml`): it calls the backend directly and never
  requests the site. Plan the maintenance so it does not overlap the canary's scheduled run.
- The scheduled `availability-alerts` function (`netlify/functions/availability-alerts.mts`):
  it is part of every deploy, including the wall deploy, and does not pass through middleware.
  Plan around its schedule the same way.
- Payments already completed at the payment provider: they stand. The page tells renters not to
  pay again.
- The 308 redirect on trailing slash paths: it happens before the wall and serves nothing of the
  app.

Outside monitors pointed at the site will see 503 while the wall is up. That is expected.
