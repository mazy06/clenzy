/** Country landing pages. Kept apart from their copy so the router stays light. */
export const BAITLY_COUNTRY_PAGES = ['maroc', 'arabie-saoudite', 'france'] as const;
export type BaitlyCountryPage = (typeof BAITLY_COUNTRY_PAGES)[number];
