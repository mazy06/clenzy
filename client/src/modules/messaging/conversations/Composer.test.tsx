// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Composer from './Composer';

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key) }),
}));

afterEach(cleanup);

function Harness({ withNote = false, onSend = vi.fn(), initial = '', disabled = false, sending = false }: {
  withNote?: boolean; onSend?: () => void; initial?: string; disabled?: boolean; sending?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [note, setNote] = useState(false);
  return (
    <Composer
      value={value}
      onChange={setValue}
      onSend={onSend}
      sending={sending}
      disabled={disabled}
      placeholder="Répondre à Sofia…"
      internalNote={withNote ? note : false}
      onInternalNoteChange={withNote ? setNote : undefined}
    />
  );
}

describe('Composer', () => {
  it('envoie avec Entrée mais pas avec Maj + Entrée', () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} initial="Bonjour" />);
    const area = screen.getByRole('textbox');
    fireEvent.keyDown(area, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('n’envoie pas un message vide, désactivé ou en cours d’envoi', () => {
    const onSend = vi.fn();
    const { rerender } = render(<Harness onSend={onSend} initial="   " />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Envoyer' }).hasAttribute('disabled')).toBe(true);

    rerender(<Harness onSend={onSend} initial="Texte" disabled />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    rerender(<Harness onSend={onSend} initial="Texte" sending />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('ne valide pas pendant une saisie IME', () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} initial="مرحبا" />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('sans bascule fournie, ne propose pas d’onglet « Note interne »', () => {
    render(<Harness />);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('bascule Répondre / Note interne et change le libellé de l’action', () => {
    render(<Harness withNote initial="Penser au ménage" />);
    const reply = screen.getByRole('tab', { name: 'Répondre' });
    const note = screen.getByRole('tab', { name: 'Note interne' });
    expect(reply.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeTruthy();

    fireEvent.click(note);
    expect(note.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Enregistrer la note' })).toBeTruthy();
    expect(screen.getByText('Visible par l’équipe uniquement')).toBeTruthy();

    fireEvent.click(reply);
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeTruthy();
  });
});
