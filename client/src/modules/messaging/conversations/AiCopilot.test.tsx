// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AiDraftCard, AttentionBadges, CopilotBar, SentimentGauge } from './AiCopilot';

// Les libellés viennent du texte de repli : le test lit ce que l'utilisateur voit.
vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown, opts?: Record<string, unknown>) =>
      typeof fallback === 'string'
        ? fallback.replace(/{{(\w+)}}/g, (_m, name: string) => String(opts?.[name] ?? ''))
        : key,
  }),
}));

afterEach(cleanup);

describe('AttentionBadges', () => {
  it('ne montre rien pour un voyageur neutre ou content', () => {
    const { container, rerender } = render(<AttentionBadges analysis={{ sentiment: 'NEUTRAL', score: 0.5, urgent: false }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AttentionBadges analysis={{ sentiment: 'POSITIVE', score: 0.9, urgent: false }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AttentionBadges analysis={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('signale l’urgence et le mécontentement', () => {
    render(<AttentionBadges analysis={{ sentiment: 'NEGATIVE', score: 0.1, urgent: true }} />);
    expect(screen.getByText('Urgent')).toBeTruthy();
    expect(screen.getByText('Mécontent')).toBeTruthy();
  });
});

describe('SentimentGauge', () => {
  it('expose la jauge comme un meter accessible', () => {
    render(<SentimentGauge analysis={{ sentiment: 'POSITIVE', score: 0.9, urgent: false }} />);
    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('100');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThan(50);
    expect(meter.getAttribute('aria-valuetext')).toBe('Satisfait');
  });
});

describe('CopilotBar', () => {
  it('lance la suggestion et la traduction, et désactive pendant la rédaction', () => {
    const onSuggest = vi.fn();
    const onTranslate = vi.fn();
    const { rerender } = render(<CopilotBar onSuggest={onSuggest} suggesting={false} onTranslate={onTranslate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggérer une réponse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Traduire' }));
    expect(onSuggest).toHaveBeenCalledTimes(1);
    expect(onTranslate).toHaveBeenCalledTimes(1);

    rerender(<CopilotBar onSuggest={onSuggest} suggesting onTranslate={onTranslate} translated />);
    expect(screen.getByRole('button', { name: 'Rédaction en cours…' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Masquer la traduction' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('AiDraftCard', () => {
  it('reprend la variante affichée, pas seulement la réponse principale', () => {
    const onUse = vi.fn();
    render(
      <AiDraftCard
        kind="suggestion"
        text="Bonjour, l’arrivée est à 15h."
        alternatives={['Bienvenue ! Arrivée dès 15h.', 'Bonjour, check-in à partir de 15h.']}
        tone="friendly"
        language="fr"
        onUse={onUse}
        onRegenerate={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('Bonjour, l’arrivée est à 15h.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Variante 1' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Variante 2' }));
    expect(screen.getByText('Bienvenue ! Arrivée dès 15h.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser' }));
    expect(onUse).toHaveBeenCalledWith('Bienvenue ! Arrivée dès 15h.');
  });

  it('n’affiche pas de sélecteur quand il n’y a qu’une réponse, ni de doublon', () => {
    render(<AiDraftCard kind="suggestion" text="Oui." alternatives={['Oui.', '']} onUse={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Variantes' })).toBeNull();
  });

  it('brouillon concierge : envoie après validation, laisse éditer ou rejeter', () => {
    const onSend = vi.fn();
    const onUse = vi.fn();
    const onDismiss = vi.fn();
    render(<AiDraftCard kind="concierge" text="Le wifi est sur le frigo." onSend={onSend} onUse={onUse} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Éditer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rejeter' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onUse).toHaveBeenCalledWith('Le wifi est sur le frigo.');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('bloque l’envoi du brouillon concierge quand la fenêtre WhatsApp est fermée', () => {
    render(<AiDraftCard kind="concierge" text="Texte" onSend={vi.fn()} sendDisabled onDismiss={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Envoyer' }).hasAttribute('disabled')).toBe(true);
  });
});
