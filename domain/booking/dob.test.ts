import { describe, expect, it } from 'vitest';
import { caretAfterDigits, digitsBefore, displayFromIso, maskDob } from './dob';

const TODAY = '2026-09-05';

describe('maskDob', () => {
  it('types as MM / DD / YYYY and stores ISO once eight valid digits are in', () => {
    expect(maskDob('01', TODAY)).toEqual({ display: '01', iso: '', error: '' });
    expect(maskDob('0115', TODAY).display).toBe('01 / 15');
    expect(maskDob('01151990', TODAY)).toEqual({ display: '01 / 15 / 1990', iso: '1990-01-15', error: '' });
    expect(maskDob('011519901', TODAY).iso).toBe('1990-01-15');
  });
  it('flags impossible, ancient and future dates with a message, never a silent empty', () => {
    expect(maskDob('02301990', TODAY)).toMatchObject({ iso: '', error: 'Enter a real date as MM / DD / YYYY.' });
    expect(maskDob('13011990', TODAY).error).toBe('Enter a real date as MM / DD / YYYY.');
    expect(maskDob('01011899', TODAY).error).toBe('Enter a real date as MM / DD / YYYY.');
    expect(maskDob('12052999', TODAY)).toMatchObject({ iso: '', error: 'That date is in the future.' });
    expect(maskDob('09062026', TODAY).error).toBe('That date is in the future.');
    expect(maskDob('09052026', TODAY).iso).toBe('2026-09-05');
  });
  it('recognises ISO-shaped and separator-shaped pastes and autofill', () => {
    expect(maskDob('1990-05-15', TODAY)).toMatchObject({ display: '05 / 15 / 1990', iso: '1990-05-15' });
    expect(maskDob('1990/5/15', TODAY).iso).toBe('1990-05-15');
    expect(maskDob('12/5/1990', TODAY)).toMatchObject({ display: '12 / 05 / 1990', iso: '1990-12-05' });
    expect(maskDob('5-12-1990', TODAY).iso).toBe('1990-05-12');
  });
  it('re-chunks a mid-string edit of the mask instead of re-padding a group, so the caret fix works', () => {
    // "12 / 05 / 1990" with the "2" deleted: the digits shift left, then typing "1" restores the month.
    expect(maskDob('1 / 05 / 1990', TODAY).display).toBe('10 / 51 / 990');
    expect(maskDob('110 / 51 / 990', TODAY)).toMatchObject({ display: '11 / 05 / 1990', iso: '1990-11-05' });
  });
  it('round-trips the stored ISO into the display', () => {
    expect(displayFromIso('1990-01-15')).toBe('01 / 15 / 1990');
    expect(displayFromIso('')).toBe('');
  });
});

describe('caret helpers', () => {
  it('keeps the caret next to the digit that was edited', () => {
    expect(digitsBefore('1 / 05 / 1990', 1)).toBe(1);
    expect(caretAfterDigits('10 / 51 / 990', 1)).toBe(1);
    expect(caretAfterDigits('01 / 15 / 1990', 2)).toBe(2);
    expect(caretAfterDigits('01 / 15 / 1990', 3)).toBe(6);
    expect(caretAfterDigits('01 / 15 / 1990', 8)).toBe(14);
    expect(caretAfterDigits('01 / 15', 0)).toBe(0);
  });
});
