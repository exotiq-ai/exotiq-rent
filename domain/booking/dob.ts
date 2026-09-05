/**
 * Date of birth as a masked field (MP-12). Pure, so it is unit-tested
 * without a browser. Digits type as MM / DD / YYYY; an ISO- or
 * separator-shaped paste or autofill ("1990-05-15", "12/5/1990") is
 * recognised and reordered first. ISO comes back only for a real date
 * between 1900 and today.
 */
export type MaskedDob = { display: string; iso: string; error: string };

const ISO_SHAPED = /^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s*$/;
const GROUPED = /^\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{4})\s*$/;

/** Our own separator. A value carrying it is a keystroke edit of the mask, never a paste. */
const MASK_SEP = ' / ';

function digitsOf(raw: string): string {
  // Reorder only pastes and autofill (no mask separator present): a mid-string
  // edit of "12 / 05 / 1990" must re-chunk the digits, not re-pad a group.
  if (!raw.includes(MASK_SEP)) {
    const iso = ISO_SHAPED.exec(raw);
    if (iso) return `${iso[2].padStart(2, '0')}${iso[3].padStart(2, '0')}${iso[1]}`;
    const grouped = GROUPED.exec(raw);
    if (grouped) return `${grouped[1].padStart(2, '0')}${grouped[2].padStart(2, '0')}${grouped[3]}`;
  }
  return raw.replace(/\D/g, '').slice(0, 8);
}

export function maskDob(raw: string, todayIso: string = new Date().toISOString().slice(0, 10)): MaskedDob {
  const digits = digitsOf(raw);
  const mm = digits.slice(0, 2);
  const dd = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let display = mm;
  if (digits.length > 2) display += ` / ${dd}`;
  if (digits.length > 4) display += ` / ${yyyy}`;
  if (digits.length < 8) return { display, iso: '', error: '' };
  const candidate = `${yyyy}-${mm}-${dd}`;
  const d = new Date(`${candidate}T00:00:00Z`);
  const real = !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === candidate;
  if (!real || Number(yyyy) < 1900) return { display, iso: '', error: 'Enter a real date as MM / DD / YYYY.' };
  if (candidate > todayIso) return { display, iso: '', error: 'That date is in the future.' };
  return { display, iso: candidate, error: '' };
}

export function displayFromIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]} / ${m[3]} / ${m[1]}` : '';
}

/** Where the caret belongs in `display` so that `n` digits sit to its left. */
export function caretAfterDigits(display: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < display.length; i += 1) {
    if (/\d/.test(display[i])) {
      seen += 1;
      if (seen === n) return i + 1;
    }
  }
  return display.length;
}

/** Digits to the left of a caret in the raw (pre-mask) value. */
export function digitsBefore(raw: string, caret: number): number {
  return raw.slice(0, caret).replace(/\D/g, '').length;
}
