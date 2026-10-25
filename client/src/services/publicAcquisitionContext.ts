export interface AcquisitionContext {
  plan?: 'essential' | 'pro' | 'custom';
  market?: 'MA' | 'EU' | 'SA';
  properties?: number;
}

/** Only non-personal, known commercial choices can follow a public link. */
export function readAcquisitionContext(search: string): AcquisitionContext {
  const params = new URLSearchParams(search);
  const context: AcquisitionContext = {};
  const plan = params.get('plan');
  const market = params.get('market');
  const properties = params.get('properties') ?? '';
  if (plan === 'essential' || plan === 'pro' || plan === 'custom')
    context.plan = plan;
  if (market === 'MA' || market === 'EU' || market === 'SA')
    context.market = market;
  if (/^[1-9]\d{0,5}$/.test(properties) && Number(properties) <= 100000)
    context.properties = Number(properties);
  return context;
}

export function acquisitionSearch(
  context: AcquisitionContext,
  language: string,
) {
  // French is the default: no `lang=fr`, so Google keeps the canonical URL.
  const params = new URLSearchParams(
    ['en', 'ar'].includes(language) ? { lang: language } : {},
  );
  // Reuse the whitelist even when a caller constructs its own object.
  const input = new URLSearchParams();
  for (const [key, value] of Object.entries(context))
    if (value != null) input.set(key, String(value));
  for (const [key, value] of Object.entries(
    readAcquisitionContext(input.toString()),
  ))
    params.set(key, String(value));
  const query = params.toString();
  return query ? `?${query}` : '';
}
