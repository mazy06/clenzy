import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ConnectedHomeScenarios from './ConnectedHomeScenarios';
import { CONNECTED_HOME_MESSAGES } from '../lib/messages/connectedHome';

afterEach(cleanup);

describe('Scénarios des objets connectés', () => {
  it.each(['fr', 'en', 'ar'] as const)('relie chaque équipement à sa situation et à sa réponse en %s', (language) => {
    const m = CONNECTED_HOME_MESSAGES[language];
    render(<ConnectedHomeScenarios language={language} />);
    const choices = screen.getByRole('group', { name: m.choose });
    const house = screen.getByRole('group', { name: m.illustration });
    for (const id of ['noise', 'entrance', 'access'] as const) {
      const item = m.scenarios[id];
      fireEvent.click(within(choices).getByRole('button', { name: new RegExp(item.label) }));
      expect(screen.getByRole('heading', { name: item.title })).toBeVisible();
      expect(screen.getByText(item.problem)).toBeVisible();
      expect(screen.getByText(item.benefit)).toBeVisible();
      expect(screen.getByText(item.boundary)).toBeVisible();
      expect(within(house).getByRole('button', { name: `${item.device} · ${item.location}` })).toHaveAttribute('aria-pressed', 'true');
      expect(within(choices).getAllByRole('button', { pressed: true })).toHaveLength(1);
      expect(screen.getAllByRole('listitem')).toHaveLength(6);
    }
  });

  it('permet de sélectionner depuis le logement et conserve le scénario au changement de langue', () => {
    const { rerender } = render(<ConnectedHomeScenarios language="fr" />);
    const camera = screen.getByRole('button', { name: 'Caméra extérieure · Entrée privée' });
    camera.focus();
    fireEvent.click(camera);
    expect(camera).toHaveFocus();
    expect(camera).toHaveAttribute('aria-controls', 'bch-scenario');
    rerender(<ConnectedHomeScenarios language="ar" />);
    expect(screen.getByRole('heading', { name: CONNECTED_HOME_MESSAGES.ar.scenarios.entrance.title })).toBeVisible();
    expect(screen.getByRole('region', { name: CONNECTED_HOME_MESSAGES.ar.title })).toHaveAttribute('dir', 'rtl');
  });

  it('présente les références et la vérification humaine sans connexion à un équipement', () => {
    const { container } = render(<ConnectedHomeScenarios language="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Caméra extérieure · Entrée privée' }));
    expect(screen.getByText(/Vérification humaine/)).toBeVisible();
    expect(container.querySelectorAll('iframe, video')).toHaveLength(0);
    expect(screen.getAllByRole('link', { hidden: true }).map((link) => link.getAttribute('href'))).toEqual([
      expect.stringContaining('paris.fr'), expect.stringContaining('airbnb.fr/help/article/3061'), expect.stringContaining('cnil.fr'),
    ]);
  });
});
