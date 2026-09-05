import { describe, expect, it } from 'vitest';
import { storefrontProvenance } from './provenance';

describe('storefrontProvenance', () => {
  it('shows the year alone when the name already starts with the make', () => {
    expect(storefrontProvenance('Audi S8 Plus', 2017, 'Audi')).toBe('2017');
    expect(storefrontProvenance('Mercedes-AMG One', 2024, 'Mercedes-AMG')).toBe('2024');
  });
  it('shows year and make when the name carries neither', () => {
    expect(storefrontProvenance('One', 2024, 'Mercedes-AMG')).toBe('2024 Mercedes-AMG');
  });
  it('shows nothing when the name already carries the year and the make', () => {
    expect(storefrontProvenance('2017 Audi S8 Plus', 2017, 'Audi')).toBe('');
    expect(storefrontProvenance('2017 S8 Plus', 2017, 'Audi')).toBe('Audi');
  });
  it('never prints a zero year or an empty make', () => {
    expect(storefrontProvenance('Ferrari 296', 0, 'Ferrari')).toBe('');
    expect(storefrontProvenance('296', null, '')).toBe('');
    expect(storefrontProvenance('296', 2023, undefined)).toBe('2023');
  });
});
