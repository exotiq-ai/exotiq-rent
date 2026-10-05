// MP-15 scope fence (AC15, negative): the diff against the merge-base with main stays inside the
// ticket's file list. Committed, staged, unstaged and untracked changes all count: a dirty tree
// cannot hide. A missing git or base ref throws (the test fails loudly, it never skips).
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { git, mergeBase } from './lib/scan.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

// The handoff's Touched-files line (spec "Scope — change" + the 8 new tests/design files), repo-relative.
const FENCE = [
  'tailwind.config.ts',
  'app/[operatorSlug]/page.tsx',
  'app/booking/[bookingId]/not-found.tsx',
  'app/browse/page.tsx',
  'app/globals.css',
  'app/layout.tsx',
  'app/not-found.tsx',
  'app/preview/page.tsx',
  'app/privacy/page.tsx',
  'app/renters/confirm/page.tsx',
  'app/renters/confirmed/page.tsx',
  'app/renters/unsubscribe/page.tsx',
  'app/renters/unsubscribed/page.tsx',
  'app/saved/page.tsx',
  'app/share/[operatorSlug]/[vehicleSlug]/opengraph-image.tsx',
  'app/share/[operatorSlug]/[vehicleSlug]/page.tsx',
  'app/verify/page.tsx',
  'components/analytics/CookieControls.tsx',
  'components/browse/BrowseChrome.tsx',
  'components/browse/EmptyState.tsx',
  'components/browse/FilterBar.tsx',
  'components/browse/FilterForm.tsx',
  'components/browse/LegalPage.tsx',
  'components/browse/ListingCard.tsx',
  'components/browse/SiteBar.tsx',
  'components/browse/tokens.ts',
  'components/drive-exotiq/BookingChrome.tsx',
  'components/drive-exotiq/BookingFlow.tsx',
  'components/drive-exotiq/CancelBookingCard.tsx',
  'components/drive-exotiq/ConfirmationActions.tsx',
  'components/drive-exotiq/ConfirmationScreen.tsx',
  'components/drive-exotiq/IdentityVerificationCard.tsx',
  'components/drive-exotiq/PaymentCard.tsx',
  'components/drive-exotiq/VehicleEntryPage.tsx',
  'components/drive-exotiq/VehicleGallery.tsx',
  'components/drive-exotiq/flow/DatesStep.tsx',
  'components/drive-exotiq/flow/DriverStep.tsx',
  'components/drive-exotiq/flow/PayStep.tsx',
  'components/drive-exotiq/flow/ReviewStep.tsx',
  'components/drive-exotiq/flow/shared.tsx',
  'components/marketplace/BookingPage.tsx',
  'components/renters/EmailCaptureForm.tsx',
  'components/renters/SaveButton.tsx',
  'components/renters/SavedLink.tsx',
  'components/renters/SavedList.tsx',
  'tests/design/tokens.test.ts',
  'tests/design/tokenBudget.test.ts',
  'tests/design/typeScale.test.ts',
  'tests/design/legacyTheme.test.ts',
  'tests/design/scopeFence.test.ts',
  'tests/design/analyticsZone.test.ts',
  'tests/design/visualProof.test.ts',
  'tests/design/lib/scan.mjs',
];
const FORBIDDEN = [/^domain\//, /^scripts\//, /^docs\//, /^app\/api\//, /^public\//, /^vitest\.config\.mts$/, /^package(-lock)?\.json$/, /^next\.config\.js$/, /^netlify/];
const lines = (out: string) => out.split('\n').map((l) => l.trim()).filter(Boolean);

describe('MP-15 scope fence', () => {
  it('the diff stays inside the MP-15 file fence', () => {
    const base = mergeBase(root);
    const changed = new Set([
      ...lines(git(root, ['diff', '--name-only', base, 'HEAD'])),
      ...lines(git(root, ['diff', '--name-only', base])), // working tree (staged + unstaged) vs the merge-base
      ...lines(git(root, ['ls-files', '--others', '--exclude-standard'])),
    ]);
    const problems: string[] = [];
    for (const file of Array.from(changed).sort()) {
      if (!FENCE.includes(file)) problems.push(`outside the fence: ${file}`);
      if (FORBIDDEN.some((re) => re.test(file))) problems.push(`forbidden path: ${file}`);
      if (file.startsWith('components/analytics/') && file !== 'components/analytics/CookieControls.tsx') problems.push(`analytics file other than CookieControls.tsx: ${file}`);
    }

    // No existing test file is modified, renamed or deleted (the new tests/design files are additions).
    const touchedExisting = new Set([
      ...lines(git(root, ['diff', '--name-only', '--diff-filter=MDR', base, 'HEAD'])),
      ...lines(git(root, ['diff', '--name-only', '--diff-filter=MDR', base])),
    ]);
    for (const file of Array.from(touchedExisting)) if (/\.test\./.test(file)) problems.push(`existing test modified: ${file}`);

    // components/marketplace/BookingPage.tsx: only the exo-gold badge line and the tone import change.
    const hunk = lines(git(root, ['diff', '-U0', base, '--', 'components/marketplace/BookingPage.tsx']))
      .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)( |$)/.test(line));
    const removed = hunk.filter((l) => l.startsWith('-')).map((l) => l.slice(1));
    const added = hunk.filter((l) => l.startsWith('+')).map((l) => l.slice(1));
    if (removed.length > 1 || removed.some((l) => !l.includes("'#C9A84C'"))) problems.push(`BookingPage.tsx: removed lines beyond the badge: ${removed.join(' | ')}`);
    const allowedAdds = ["import { tone } from '@/components/browse/tokens';", ...removed.map((l) => l.replace("'#C9A84C'", 'tone.gold').trim())];
    for (const line of added) if (!allowedAdds.includes(line.trim())) problems.push(`BookingPage.tsx: unexpected added line: ${line.trim()}`);

    expect(problems).toEqual([]);
  });
});
