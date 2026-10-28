/** "Alternative to X" pages. Kept apart from their copy so the router stays light. */
export const BAITLY_ALTERNATIVE_PAGES = [
  'guesty',
  'lodgify',
  'smoobu',
  'hostaway',
] as const;
export type BaitlyAlternative = (typeof BAITLY_ALTERNATIVE_PAGES)[number];

/**
 * Competitor facts are read on the vendor's own pricing page, never on a
 * review site: third-party price lists contradict each other. Re-check the
 * page and move this date before changing any competitor fact.
 */
export const ALTERNATIVES_CHECKED_AT = '2026-10-28';

export const BAITLY_ALTERNATIVE_VENDORS: Record<
  BaitlyAlternative,
  { name: string; pricingUrl: string }
> = {
  guesty: { name: 'Guesty', pricingUrl: 'https://www.guesty.com/pricing/' },
  lodgify: { name: 'Lodgify', pricingUrl: 'https://www.lodgify.com/pricing/' },
  smoobu: { name: 'Smoobu', pricingUrl: 'https://www.smoobu.com/en/pricing/' },
  hostaway: {
    name: 'Hostaway',
    pricingUrl: 'https://www.hostaway.com/pricing/',
  },
};

export const alternativePath = (slug: BaitlyAlternative) =>
  `/alternative-${slug}`;
