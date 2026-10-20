/** Recette visuelle isolée : identités fictives, aucun appel métier ni envoi. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import fr from '../../public/locales/fr.json';
import ar from '../../public/locales/ar.json';
import '../../src/theme/signature/tokens.css';
import '../../src/theme/base.css';
import '../../src/theme/baitly-ui.css';
import ContactPresentation from '../../src/components/ContactPresentation';

const params = new URLSearchParams(location.search);
const rtl = params.get('rtl') === '1';
document.documentElement.dir = rtl ? 'rtl' : 'ltr';
document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light';
await i18next.init({ lng: rtl ? 'ar' : 'fr', interpolation: { escapeValue: false }, resources: { fr: { translation: fr }, ar: { translation: ar } } });
createRoot(document.getElementById('root')!).render(<I18nextProvider i18n={i18next}>
  <main style={{ padding: 20, maxWidth: 720, marginInline: 'auto', color: 'var(--bui-foreground)' }}>
    <h1 style={{ fontSize: 18 }}>Identités fictives, recette de mise en page</h1>
    <section style={{ padding: 20, background: 'var(--bui-card)', borderRadius: 10, border: '1px solid var(--bui-border)' }}>
      <ContactPresentation name="Alexandra-Marie Benali de La Roche-Saint-Clair" label="Voyageur de recette"
        phone="+33 6 12 34 56 78" email="alexandra-marie.benali-de-la-roche-saint-clair.recette@example.invalid" />
      <ContactPresentation name="Équipe de conciergerie internationale et services aux voyageurs de recette" label="Prestataire" role="Équipe" team />
      <ContactPresentation name="Aucun prestataire confirmé" label="Prestataire" pending />
    </section>
  </main>
</I18nextProvider>);
