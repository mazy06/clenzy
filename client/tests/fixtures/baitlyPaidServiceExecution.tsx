/** Fixture visuelle isolée : aucun appel au backend, aucun envoi ni paiement. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import fr from '../../public/locales/fr.json';
import '../../src/theme/signature/tokens.css';
import '../../src/theme/base.css';
import '../../src/theme/baitly-ui.css';
import BaitlyPaidServiceExecution from '../../src/modules/welcome-guide/BaitlyPaidServiceExecution';
import BaitlyGuestServiceTracking from '../../src/modules/welcome-guide/BaitlyGuestServiceTracking';
import { injectWelcomeBookCss } from '../../src/modules/welcome-guide/welcomeBookThemes';
import { upsellApi, type PaidServiceExecution, type UpsellOrder } from '../../src/services/api/upsellApi';

await i18next.init({ lng: 'fr', interpolation: { escapeValue: false }, resources: { fr: { translation: fr } } });
injectWelcomeBookCss();
const code = new URLSearchParams(location.search).get('service') ?? 'cleaning-mid-stay';
const titles: Record<string, string> = { 'cleaning-mid-stay': 'Ménage pendant le séjour', 'culinary-breakfast': 'Petit-déjeuner livré', 'driver-airport': 'Transfert aéroport', 'driver-station': 'Transfert gare' };
const title = titles[code] ?? titles['cleaning-mid-stay'];
let view: PaidServiceExecution = { orderId: 8, title, paymentStatus: 'PAID', state: 'TO_SCHEDULE',
  serviceRequestId: null, interventionId: null, start: null, durationHours: null, timezone: 'Europe/Paris',
  stayStart: '2026-10-20T15:00', stayEnd: '2026-10-24T11:00', canSchedule: true,
  scheduleStart: code.startsWith('driver-') ? '2026-10-20T00:00' : '2026-10-20T15:00',
  scheduleEnd: code.startsWith('driver-') ? '2026-10-25T00:00' : '2026-10-24T11:00' };
const order = { id: 8, title: view.title, status: 'PAID', fulfillmentServiceCode: code } as UpsellOrder;
upsellApi.execution = async () => view;
upsellApi.schedule = async (_id, plan) => {
  view = { ...view, start: plan.start, durationHours: plan.durationHours, state: 'REQUESTED', serviceRequestId: 90, canSchedule: false };
  return view;
};
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => String(input).endsWith('/api/public/guide/fixture/services')
  ? new Response(JSON.stringify([view, { ...view, orderId: 9, title: 'Parking réservé', state: 'COMPLETED', start: null }]), { headers: { 'Content-Type': 'application/json' } })
  : originalFetch(input, init);
const client = new QueryClient();
createRoot(document.getElementById('root')!).render(<I18nextProvider i18n={i18next}><QueryClientProvider client={client}><MemoryRouter>
  <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
    <header><p className="text-xs text-muted-foreground">Recette visuelle isolée, sans envoi au backend</p>
      <h1 className="text-xl font-semibold">{title}</h1></header>
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="m-0 text-base font-semibold">Vente #8 · Loft Bastille</h2>
      <p className="text-sm text-muted-foreground">20 au 24 octobre · 60 € réglés par le voyageur</p>
      <BaitlyPaidServiceExecution order={order} />
    </section>
    <section className="wb rounded-lg p-4" data-theme="atelier">
      <p className="m-0 text-sm">Vue du voyageur, thème Atelier</p>
      <BaitlyGuestServiceTracking token="fixture" apiBase="" lang="fr" />
    </section>
  </main>
</MemoryRouter></QueryClientProvider></I18nextProvider>);
