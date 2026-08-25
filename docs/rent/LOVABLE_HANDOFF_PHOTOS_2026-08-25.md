# Lovable handoff — vehicle photo pipeline (Command Center / Supabase fixes)

Date: 2026-08-25 · From: Claude (renter-app side) · Context: photos stopped
rendering on book.exotiq.rent **vehicle detail pages** for the
exotics-by-the-bay tenant. Root cause traced and verified live; the
renter-app half is already fixed on `claude/exotiq-photo-rendering-pj4rig`
(this repo). This document is the Command Center / Supabase half — the parts
only the Lovable side can change.

---

## What broke (evidence, verified live 2026-08-25)

Every image on every EBTB detail page was a **dead 1-hour signed URL**.

- The renter app fetches detail-page galleries from the `rent-public-media`
  edge function, which signs `storage_path` with a **3600s TTL**.
- The renter app cached that fetch (`next: { revalidate: 300 }`); Netlify's
  durable data cache served the **build-time response for six days**. The
  live Huracán page on 2026-08-25 still contained tokens with
  `exp = 2026-08-19T17:04:57Z` — minted at the Aug 19 deploy, dead an hour
  later. Direct fetch: `400 InvalidJWT ("exp" claim timestamp check failed)`.
- EBTB was hit hardest because all 16 of its vehicles have `vehicle_photos`
  rows, so the media response **replaces** the hero. Most `exotiq` demo
  vehicles have no `vehicle_photos` rows, fall back to their long-lived
  `hero_image_url`, and kept rendering — which is why the grid looked fine
  while EBTB detail pages were blank.

Renter-side fix (already made, ships with the next deploy): the media fetch
is now `cache: 'no-store'` (signed URLs are minted per request), the stored
RPC gallery is used as fallback, non-https URL values are filtered, and
broken images degrade to a placeholder instead of an empty frame.

**The same class of bug is still loaded on the Command Center side.** Five
fixes below, in priority order.

---

## 1. `rent-public-media` returns thumbnails it never re-signs

`supabase/functions/rent-public-media/index.ts:113` returns
`thumbnailUrl: p.thumbnail_url` **verbatim from the DB** while re-signing
only the full-size image. Stored thumbnail URLs are 1-year signed tokens
(see §3) — they will rot, and any renter UI built on thumbnails breaks even
when the function returns 200.

Fix: derive the thumbnail path from `storage_path` (upload convention:
same path with `_thumb.jpg` substituted — see `src/lib/photoUpload.ts`)
and include it in the same `createSignedUrls` batch. If a thumb object
doesn't exist, return `null` and let the client fall back to `signedUrl`.

## 2. `rent-public-media` silently drops NULL-flag photos

`index.ts:83-84` filters `.eq("is_visible", true).eq("is_vehicle_confirmed",
true)` — PostgREST `eq` never matches NULL, so any photo row with a NULL in
either column is invisible to renters. The read RPCs use
`coalesce(vp.is_visible, true)` and `get_marketplace_readiness` uses
`is_visible IS NOT FALSE`: **three different NULL semantics across three
read paths**, so the readiness panel can call a vehicle photo-ready while
the media endpoint returns `{photos: []}`.

Fix (pick one, apply everywhere):
- Normalize the function to match the RPCs: `.not("is_visible", "is", false)`
  and `.not("is_vehicle_confirmed", "is", false)`; **or**
- Backfill NULLs to true and add `NOT NULL DEFAULT true` to both columns.

## 3. Stop persisting signed URLs into the database

Uploads persist **1-year signed URLs** into `vehicle_photos.url` /
`thumbnail_url` (`src/lib/photoUpload.ts:82-84`,
`src/components/photos/usePhotoAnalysis.ts:92-94`,
`AddVehicleFromPhotoWizard.tsx:166-167`), and the `sync_hero_to_vehicle`
trigger copies them into `vehicles.image_url`. These are bearer tokens with
a fuse: live counts today are **7 of 16 EBTB heroes and 7 of 52 exotiq
heroes** expiring 2027-07/08 — a scheduled repeat of this outage. They also
all die at once if the project JWT secret is ever rotated.

Fix:
- On upload, store `storage_path` (already done) plus a **stable** URL —
  `getPublicUrl` if the bucket stays public (§4) — never `createSignedUrl`.
- One-time migration: for every `vehicle_photos.url` / `thumbnail_url` /
  `vehicles.image_url` containing `/object/sign/`, rewrite to the public
  URL form from `storage_path` (or re-derive via `getPublicUrl`).

## 4. Decide the bucket's public/private story and commit it

Repo migrations end with `vehicle-photos` **private**
(`20251031232021…sql` sets `public = false`; nothing ever sets it back),
but `generate-hero-image/index.ts:213-217` has written `getPublicUrl`
values since 2026-08-10 claiming "bucket is now public" — and those URLs
work live, so the hosted flag was flipped **out-of-band** and the repo is
lying about production. Meanwhile `rent-public-media`'s header comment
still asserts the bucket is private.

Fix: keep it public (simplest — renter photos are public marketing content),
and:
- add a migration recording `public = true` so repo state matches hosted;
- update the `rent-public-media` comment/design note (with a public bucket
  it can eventually return public URLs and stop signing entirely);
- confirm storage RLS still restricts **writes** to authenticated team
  members (the four `TO authenticated` object policies from
  `20260715211500…sql`).

If you instead keep it private, then §3's "stable URL" must become a
storage-path-only scheme and every read path must sign on demand — more
work; not recommended.

## 5. Data hygiene: purge filesystem paths from photo columns

`vehicles.image_url` demonstrably contains `/src/assets/…` and
`/lovable-uploads/…` values — the Command Center has **two client-side
filters** built specifically to hide them (`src/lib/vehicleImageMapping.ts:123`,
`src/components/common/VehicleThumbnail.tsx:36-44`). The renter app resolves
them against its own origin and 404s (it now filters them too, but the data
is still wrong).

Fix: null out or rewrite every non-`https://` value in
`vehicles.image_url`, `vehicle_photos.url`, `vehicle_photos.thumbnail_url`;
where the vehicle has a real `vehicle_photos` row, backfill from
`coalesce(enhanced_url, url)` (the sync trigger's own rule).

Related, lower priority: most exotiq demo vehicles have **zero
`vehicle_photos` rows** (heroes are one-off AI generations), so their detail
pages have no gallery. Backfill rows from the generated images if the demo
fleet should show galleries.

---

## Verification checklist (run after the fixes)

SQL:

```sql
-- 1. No signed or relative URLs left in photo columns (want: 0 rows each)
select count(*) from vehicle_photos where url like '%/object/sign/%' or thumbnail_url like '%/object/sign/%';
select count(*) from vehicles where image_url like '%/object/sign/%' or (image_url is not null and image_url not like 'https://%');
-- 2. No NULL visibility flags (want: 0)
select count(*) from vehicle_photos where is_visible is null or is_vehicle_confirmed is null;
```

Probes (anon key):

```sh
# Media endpoint returns photos AND a fresh thumbnail for a vehicle with photos
curl -s "https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/rent-public-media?team=exotics-by-the-bay&vehicle=2022-lamborghini-huracan-evo-spyder" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# Every fleet hero fetches 200
curl -s "https://jlgwbbqydjeokypoenoc.supabase.co/rest/v1/rpc/public_team_fleet" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"_team_slug":"exotics-by-the-bay"}'
```

End-to-end (after the renter-app branch also deploys): load
`book.exotiq.rent/exotics-by-the-bay/2022-lamborghini-huracan-evo-spyder`,
view source, and check every `/_next/image?url=` source either is an
`/object/public/` URL or carries a token whose decoded `exp` is in the
future; each should fetch 200 directly.
