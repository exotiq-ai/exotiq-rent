---
name: goal
description: Enter goal mode for the Exotiq Rent renter-facing direct booking platform. Resumes the long-horizon build from the last checkpoint and works milestone by milestone until done.
disable-model-invocation: true
---

# Goal Mode — Exotiq Rent Renter App

You are entering goal mode for the renter-facing direct booking platform.

The mission docs live in the Command Center repo
(`exotiq-ai/exotiq-spark-mvp-flow`) under `docs/rent/`. Fetch them via the
`gh` CLI or raw.githubusercontent.com (branch `main`, or the latest goal-mode
branch if not yet merged):

1. Read `docs/rent/RENTER_APP_GOAL.md` in full. It is the mission brief and
   contains the hard rules, milestones (M0–M6), standing blockers, and the
   decision register. Its rules override any conflicting default behavior.
2. Read `docs/rent/PLAN_REVIEW_2026-07-15.md` for the plan audit and known
   contradictions.
3. Read `docs/rent/CHECKPOINT.md`. If it does not exist, create it and start
   at the first incomplete milestone (M0 unless stated otherwise).
4. Read `docs/rent/DECISIONS.md` if it exists. Undecided items default to the
   recommended defaults in the goal doc's decision register; record any
   assumption you rely on.
5. Resume work from the checkpoint. This repo (`exotiq-ai/exotiq-rent`) owns
   the renter-facing frontend only — milestones M0, M4, and the frontend
   halves of M5/M6. Schema, RPCs, and edge functions belong in
   `exotiq-spark-mvp-flow`; never add Supabase migrations here.
6. Verify every change per the goal doc's verification gate before
   committing: `npm test`, `npx tsc --noEmit`, `npm run lint` (warnings
   only), `npm run build`, route smoke (all six routes 200, bad slug 404).
   Commit and push on feature branches with PRs — never to main.
7. Before ending the session, update `docs/rent/CHECKPOINT.md` in the
   Command Center repo (or note checkpoint updates in the PR description if
   that repo is not writable from the session) with completed items (with PR
   links), the in-flight branch, blockers hit, and the exact next action.

If the user passed extra instructions after `/goal`, treat them as the
session's priority within the goal's rules (e.g. `/goal focus on M0 demo
polish`).
