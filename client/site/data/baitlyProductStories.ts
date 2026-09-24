export const PRODUCT_STORY_SLUGS = {
  agents: 'agents-ia',
  revenue: 'revenue-market-data',
  finance: 'paiements-finances',
  operations: 'operations-menage',
  devices: 'objets-connectes',
  owners: 'portail-proprietaire',
} as const;

export type ProductStoryKind = keyof typeof PRODUCT_STORY_SLUGS;

export function productStoryKind(
  slug: string | undefined,
): ProductStoryKind | undefined {
  return (Object.keys(PRODUCT_STORY_SLUGS) as ProductStoryKind[]).find(
    (kind) => PRODUCT_STORY_SLUGS[kind] === slug,
  );
}

/** Montants fictifs en MAD, uniquement pour les scènes de démonstration. */
export function demoNightlyPrices(scenario: number, floor: number) {
  const factors = [0.86, 1, 1.14];
  return [780, 800, 820, 850, 960, 990, 860].map((price) =>
    Math.max(floor, Math.round((price * factors[scenario]) / 10) * 10),
  );
}

export const OWNER_DEMO_MONTHS = [
  { gross: 18400, expenses: 1450 },
  { gross: 21600, expenses: 1680 },
  { gross: 19200, expenses: 1520 },
];

export function demoOwnerStatement(month: number) {
  const { gross, expenses } = OWNER_DEMO_MONTHS[month];
  const commission = Math.round(gross * 0.2);
  return { gross, expenses, commission, net: gross - expenses - commission };
}
