import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { NotificationProvider, useNotification } from '../useNotification';

/**
 * Le système de notification est passé de MUI Snackbar à sonner. Son API
 * publique — `notify.success/error/warning/info`, `showNotification`,
 * `clearAll` — est consommée par 13 écrans qui n'ont PAS été touchés : ces
 * tests verrouillent ce contrat, pour qu'un changement d'implémentation ne le
 * rompe pas en silence.
 */

function Declencheur({ action }: { action: (n: ReturnType<typeof useNotification>) => void }) {
  const n = useNotification();
  return <button onClick={() => action(n)}>declencher</button>;
}

function monter(action: (n: ReturnType<typeof useNotification>) => void) {
  return render(
    <NotificationProvider>
      <Declencheur action={action} />
    </NotificationProvider>,
  );
}

describe('useNotification', () => {
  it('affiche le message passé à notify.success', async () => {
    monter((n) => n.notify.success('Propriété créée'));
    await act(async () => { screen.getByText('declencher').click(); });
    expect(await screen.findByText('Propriété créée')).toBeInTheDocument();
  });

  it('affiche aussi les erreurs', async () => {
    monter((n) => n.notify.error('Erreur de sauvegarde'));
    await act(async () => { screen.getByText('declencher').click(); });
    expect(await screen.findByText('Erreur de sauvegarde')).toBeInTheDocument();
  });

  it('showNotification accepte une severite explicite', async () => {
    monter((n) => n.showNotification('Données incomplètes', 'warning'));
    await act(async () => { screen.getByText('declencher').click(); });
    expect(await screen.findByText('Données incomplètes')).toBeInTheDocument();
  });

  it('ne jette pas hors du provider — les consommateurs testés isolement', () => {
    // Le repli silencieux existait deja avec MUI ; plusieurs tests d'ecran
    // montent leur composant sans provider et comptent dessus.
    function Seul() {
      const n = useNotification();
      n.notify.info('sans provider');
      return <span>rendu</span>;
    }
    expect(() => render(<Seul />)).not.toThrow();
  });
});
