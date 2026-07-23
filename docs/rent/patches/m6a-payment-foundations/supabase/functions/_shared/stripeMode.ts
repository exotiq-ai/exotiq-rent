// M6a — mode-aware Stripe helper shared by the renter money functions.
// Ref: exotiq-rent docs/rent/M6_MONEY_PLAN.md §2 (sandbox-first).
//
// The mode is derived from STRIPE_SECRET_KEY itself — there is deliberately
// no separate "mode" env var to drift out of sync. Flipping to live is
// swapping the secret (and webhook secret), nothing else.

export type StripeMode = "test" | "live";

export function resolveStripeMode(): StripeMode {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  throw new Error("STRIPE_SECRET_KEY is missing or malformed — cannot determine Stripe mode");
}

export type TeamStripeColumns = {
  stripe_account_id: string | null;
  stripe_test_account_id: string | null;
};

/**
 * The connected account to charge for this team in the CURRENT mode.
 * Hard-fails when the mapping is absent: money must never silently route to
 * the platform account or to a wrong-mode connected account (a test PI
 * against a live acct id — or vice versa — errors at Stripe anyway, but we
 * want the clear message, not Stripe's).
 */
export function teamConnectedAccountId(team: TeamStripeColumns, mode: StripeMode = resolveStripeMode()): string {
  const id = mode === "test" ? team.stripe_test_account_id : team.stripe_account_id;
  if (!id) {
    throw new Error(
      mode === "test"
        ? "Team has no stripe_test_account_id — create the test-mode Connect account before sandbox payment runs (M6a README)."
        : "Team has no stripe_account_id — complete Stripe onboarding before live payments.",
    );
  }
  return id;
}
