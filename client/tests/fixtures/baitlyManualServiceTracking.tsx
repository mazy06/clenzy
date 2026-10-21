/** Recette visuelle isolée : seules les lectures de session sont réelles, les opérations restent en mémoire. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import fr from '../../public/locales/fr.json';
import '../../src/theme/signature/tokens.css';
import '../../src/theme/base.css';
import '../../src/theme/baitly-ui.css';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext';
import BaitlyCommerceOperationsPanel from '../../src/modules/payments/BaitlyCommerceOperationsPanel';
import { baitlyCommerceApi, type CommerceOperation } from '../../src/services/api/baitlyCommerceApi';
import { Button, FieldLabel, NativeSelect } from '../../src/components/ui';

await i18next.init({ lng: 'fr', interpolation: { escapeValue: false }, resources: { fr: { translation: fr } } });
const records = new Map<number, CommerceOperation[]>();
const attempts = new Map<string, CommerceOperation>();
baitlyCommerceApi.operations = async (_source, id) => records.get(id) ?? [];
baitlyCommerceApi.recordOperation = async body => {
  const previous = attempts.get(body.requestId);
  if (previous) return previous;
  const row = { id: attempts.size + 1, action: body.action, proof: body.proof, note: body.note, createdAt: new Date().toISOString() };
  attempts.set(body.requestId, row);
  records.set(body.sourceId, [...(records.get(body.sourceId) ?? []), row]);
  return row;
};
const names = ['Arrivée anticipée', 'Départ tardif', 'Parking'];
function Recipe() {
  const { user, loading, hasAnyRole } = useAuth();
  const [selected, setSelected] = useState(0);
  const [readOnly, setReadOnly] = useState(false);
  return <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
    <header><p className="text-sm text-muted-foreground">Recette isolée : aucun paiement, aucune écriture métier dans le backend</p>
      <h1 className="text-xl font-semibold">Services sans intervention</h1></header>
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1"><FieldLabel htmlFor="test-service">Service fictif</FieldLabel>
        <NativeSelect id="test-service" className="w-full [&_select]:min-h-11 [&_select]:w-full" value={selected} onChange={event => setSelected(Number(event.target.value))}>{names.map((name, index) => <option key={name} value={index}>{name}</option>)}</NativeSelect>
      </div>
      <Button type="button" variant="outline" className="min-h-11" aria-pressed={readOnly} onClick={() => setReadOnly(value => !value)}>Lecture seule</Button>
    </div>
    {loading ? <p>Vérification de la session locale…</p> : !user ? <p>La session de recette locale doit être ouverte.</p> :
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-base font-semibold">[TEST] {names[selected]}</h2>
        <p className="mb-4 text-sm text-muted-foreground">Réservation synthétique. Aucun accès au logement ni place réelle à attribuer.</p>
        <BaitlyCommerceOperationsPanel source="UPSELL" sourceId={99001 + selected} canEdit={!readOnly && hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER'])} />
      </section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<I18nextProvider i18n={i18next}><QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><Recipe /></AuthProvider></MemoryRouter></QueryClientProvider></I18nextProvider>);
