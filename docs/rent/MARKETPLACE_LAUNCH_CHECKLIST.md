# Exotiq Rent — Owner's Launch Checklist

**For:** Gregory. **Written:** 2026-07-16. **Maintained by:** the goal-mode agent — ask for updates any time with `/goal update the launch checklist`.

This is the human playbook for taking Exotiq Rent from tonight's state (Gold
booking demo live on mock data) to a running marketplace with real cars, real
bookings, and real money. It complements the technical mission brief in the
Command Center repo (`exotiq-spark-mvp-flow/docs/rent/RENTER_APP_GOAL.md`);
where they disagree, the mission brief wins.

**A note on "how many days":** phases below are gates, not calendar weeks.
Agent build time is never the bottleneck — most phases are one or two working
sessions once their gate opens. The calendar is driven by three outside
clocks: **Lovable** (applying migrations + the migration export), **Stripe**
(test-mode verification, then your live approval), and **you** (decisions,
QA passes, legal copy, and real inventory). Each phase says exactly which
clock it's on.

---

## Where you are right now (2026-07-16)

Already done — no action needed, just so you know what you're standing on:

- [x] Gold booking flow (Vehicle → Dates → Driver → Extras → Protect → Review → Pay → Confirmation), mock-backed, verified green
- [x] Mock catalog: 3 teams, 10 visible vehicles, unavailable dates, hidden-vehicle behavior
- [x] All ten decisions (D1–D10) recorded; fee math and protection pricing implemented to match
- [x] Backend security fixes (M2) and public read plumbing (M3) merged in the Command Center repo — **not yet applied to the hosted database**
- [x] **`exotiq.rent` is LIVE with the Gold flow.** Production auto-deploys from `main`; the D8 merge replaced the old mockup site tonight. The old marketplace homepage is retired from the root (it redirects to the demo storefront).
- [x] `demo.exotiq.rent` exists but is a frozen one-off deploy (see Phase 0)

---

## Phase 0 — Take control of your deploys

**Your time: one sitting, mostly clicking. Clock: you.**

The goal: you know exactly what URL shows what, and every future merge
deploys itself.

- [ ] **Decide what `exotiq.rent` should show today.** It currently shows the
      Gold booking demo with mock cars, live to the public. If that's fine
      for now (it looks far better than Coming Soon), do nothing. If you want
      it gated until real inventory, tell me:
      `/goal put a coming-soon gate back on production, keep the demo reachable at a path or subdomain`
- [ ] **Fix or retire `demo.exotiq.rent`.** It's a manual snapshot that will
      only get staler. From Cursor desktop with the Netlify MCP, either link
      that Netlify site to the `exotiq-ai/exotiq-rent` repo (production
      branch `main`) so it tracks main like production does — or delete the
      site and point the `demo` DNS record at the production site. One
      sentence to the MCP does it.
- [ ] **Merge PR #6** (month navigation, editable driver form, branded 404).
      Production picks it up automatically.
- [ ] **Confirm the Netlify token works for agents:** launch a fresh cloud
      agent (new VMs pick up the secret; old ones can't) with:
      `/goal confirm NETLIFY_AUTH_TOKEN works and report the Netlify sites you can see`

**Exit gate:** you can say out loud which site tracks `main` (should be:
both, or production only — by choice), and PR #6 is live.

---

## Phase 1 — Finish the demo: polish, QA, rehearsal

**Sessions: 1–2 agent sessions + one evening of yours. Clock: you.**

- [ ] Tell me: `/goal punch-list polish pass — compare every screen to the canonical design side by side and close the density/copy gaps`
- [ ] Tell me: `/goal phone click-through QA — walk the whole flow at phone viewport, list every rough edge, fix the quick ones`
- [ ] Ask me for **walkthrough notes for your pitch** — the happy path, what
      to tap, and the one-liner talking point per screen (two-charge
      transparency, protection consent, verified documents).
- [ ] **You: rehearse on your actual phone.** Full flow, twice, on
      `exotiq.rent`. Note anything that makes you hesitate — those hesitations
      are the punch list, round two.
- [ ] **You: approve or rewrite the protection decline terms.** The current
      wording is my draft of your D5 ruling (renter liable for total cash
      value; personal insurance verified before pickup). It reads like legal
      copy, so a lawyer's eyes are recommended before real renters see it.

**Exit gate (this is M0 done):** a stranger with the URL completes the whole
flow on a phone without hitting a rough edge, and you've rehearsed the pitch.

---

## Phase 2 — Gold & black everywhere: one brand, whole site

**Sessions: 1–3 agent sessions + your approvals. Clock: you.**

Right now the booking flow is Gold-standard but the edges aren't: legacy
marketplace pages still exist in the codebase (`/preview` and the old
components), and naming drifts between "Drive Exotiq" and "Exotiq Rent".
This phase makes the entire public surface one cohesive brand.

- [ ] **You decide the name, once:** is the renter-facing brand
      **Exotiq Rent** or **Drive Exotiq**? (Logos, page titles, statement
      descriptor `EXOTIQ.RENT`, and confirmation copy all follow from this.
      My recommendation: Exotiq Rent, matching the domain and the Stripe
      descriptor.)
- [ ] Tell me: `/goal branding unification — retire or rebrand every legacy marketplace surface, one brand name everywhere, gold #C8A664 / black across all routes including 404, preview, and confirmation`
- [ ] Tell me to do a **metadata & link-preview pass**: favicon, OG images
      (what shows when a storefront link is texted to a client), page titles.
      Send me the logo files you want used if different from what's in the repo.
- [ ] **You: click every route** (storefronts, vehicle pages, 404, booking
      confirmation) and confirm nothing breaks the spell. The design locks
      from the handoff stay locked: Newsreader for headlines only, Inter for
      prices, no emoji, no urgency clutter.

**Exit gate:** there is no page a renter can reach that looks like "the old
site." Screenshot-worthy everywhere.

---

## Phase 3 — Real cars on the screen (with Lovable)

**Sessions: 2–3 agent sessions. Clock: Lovable + you.**

This is where the storefront stops being fiction. The backend work (M2
security + M3 public reads) is merged in the Command Center repo but must be
applied to the hosted database through Lovable — you're already coordinating
this catch-up.

- [ ] **You, with Lovable:** apply the merged migrations
      (`20260715211500_*`, `20260715220000/220100_rent_public_*`) and deploy
      the `rent-public-media` edge function. Hand them the file list so their
      schema snapshot includes it — this is already written into the decision
      log (D3 rule).
- [ ] **You: pick the pilot operator** (one real team). In the Command
      Center: real vehicle photos, correct daily rates, minimum days, deposit
      amounts. Good photos matter more than anything an agent builds this
      phase.
- [ ] Tell me: `/goal M4 — build the supabase read client behind the data-mode flag, contract tests against the RPC shapes, mock mode stays green with no env`
- [ ] **You: flip `marketplace_visible`** on the pilot team when you're ready
      to see it. (Until you flip it, nothing is publicly readable — that's by
      design.)
- [ ] Together: compare the real storefront against the mock one; fix the
      gaps (missing photos, odd copy, absurd-looking rates).

**Exit gate (M4 done):** `exotiq.rent/<real-team>` renders a real storefront
from the real database, and the mock demo still works with no configuration.

---

## Phase 4 — The database moves house (external gate)

**Sessions: agent support as needed. Clock: Lovable, entirely.**

The migration cutover to the new Supabase project. This gates all booking
and payment work — it's the one queue you should actively chase.

- [ ] **You: chase Lovable support for the export artifacts** — full
      `pg_dump`, auth users export, storage binaries. This has been
      outstanding since before the goal brief was written. A weekly nudge is
      appropriate.
- [ ] When artifacts arrive, the cutover follows the runbooks in
      `exotiq-spark-mvp-flow/docs/migration/` — schema freeze during the
      window, then everything merged in Phases 0–3 replays automatically
      (it's all repo migrations; that's why we did it this way).
- [ ] **You: schema freeze discipline** — during the window, no new Lovable
      schema edits, no new migrations merged.

**Exit gate:** the app reads from the new project; nothing publicly visible
changed.

---

## Phase 5 — Real bookings (no money yet)

**Sessions: 2–4 agent sessions + your test bookings. Clock: you.**

Hard-gated on Phase 4. A renter can now actually request a car.

- [ ] Agents build (both repos): `renter-create-booking` with server-side
      re-validation, document upload to a private bucket, the new lifecycle
      states (`requested`, `pending_documents`, `pending_payment`, …), and
      the database-level double-booking constraint **before** concurrent
      writes open — proven by a concurrency test.
- [ ] **You decide the operator workflow:** who approves a `requested`
      booking, and how fast? (This is an operations promise to renters, not
      a technical setting.)
- [ ] **You: make three test bookings as a fake renter** — happy path,
      double-booked dates (must be impossible), and an abandoned booking.
      Check each shows correctly in the Command Center.

**Exit gate (M5 done):** a real booking created end-to-end from the renter
app in staging; the double-booking constraint has a passing concurrency test.

---

## Phase 6 — Money (Stripe, test mode until you say otherwise)

**Sessions: 3–5 agent sessions + two sit-downs of yours. Clock: you + Stripe.**

The most consequential phase, and the one with a decision you've already
flagged for yourself.

- [ ] **You FIRST: the money-flow review.** Your D1 ruling means the renter
      sees two statement lines (operator rental charge + Exotiq booking
      fee/protection). Before any Stripe code is written, you review how the
      money should route: destination charge to the operator's connected
      account + a separate platform charge for fee/protection is the shape on
      the table. One sit-down with me walking you through the options in
      plain English — say `/goal walk me through the Stripe money-flow options for D1, no jargon`.
- [ ] Agents build: hosted Checkout (never raw card data), the deposit
      authorization hold, webhooks as the source of truth, 72-hour free
      cancellation refund logic, idempotency keyed by booking — and the
      hardcoded 20% dies, replaced by your D1 fee everywhere.
- [ ] **You: full test-mode dress rehearsal** with a Stripe test card:
      book → pay → see the two charges in the test dashboard → cancel inside
      72h → watch the refund arrive.
- [ ] **You: explicitly approve live mode.** Nothing goes live until you say
      the words. Then one real booking with your own card as the final check.

**Exit gate (M6 done):** the full Stripe test-mode end-to-end passes;
refund windows verified through webhooks; you have said "go live" in writing.

---

## Phase 7 — Launch hardening & go-live

**Sessions: 1–2 agent sessions + your operational prep. Clock: you.**

- [ ] **Legal set, final:** rental agreement, protection terms, decline
      terms (from Phase 1), privacy policy, terms of service. Lawyer pass.
- [ ] **Inventory beyond the pilot:** each live team has photos, rates,
      deposits, and buffer times you'd defend to a customer's face.
- [ ] **Operator onboarding checklist** (I'll draft it): what a new team must
      provide before you flip them visible.
- [ ] Analytics + error monitoring: pick your tools (or accept my defaults)
      so launch week isn't flying blind.
- [ ] Final click-through on production, on a phone, with real inventory and
      live payments.
- [ ] **Flip the last team visible, tell the world.** The mockup-to-marketplace
      switch completes here — same domain, no migration for users, because
      production has been tracking `main` since Phase 0.

**Exit gate:** first stranger's booking with real money, handled cleanly,
visible in the Command Center, money in the right accounts.

---

## The short version to keep on your desk

| Phase | What it delivers | Whose clock | Can run in parallel with |
|---|---|---|---|
| 0 | You control the deploys | You (one sitting) | everything |
| 1 | Demo finished + rehearsed | You | 2, 3 |
| 2 | Gold & black, one brand, whole site | You | 1, 3 |
| 3 | Real cars on real storefronts (M4) | Lovable + you | 1, 2 |
| 4 | Database cutover | Lovable | — (freeze) |
| 5 | Real bookings (M5) | You | 6 prep only |
| 6 | Real money (M6) | You + Stripe | — |
| 7 | Hardening + go-live | You | — |

Phases 1–3 overlap freely. Phase 4 is the hinge — everything after it waits
on Lovable's export, so the single highest-leverage thing you can do for the
calendar is keep that request warm. Phases 5–7 are strictly ordered.

Standing rules that never change along the way: no pushes to `main` without a
PR, Stripe stays in test mode until your explicit approval, the hosted
database is only ever touched through migrations applied by Lovable/you, and
if a plan document and reality disagree, reality wins and the document gets
fixed in the same PR.
