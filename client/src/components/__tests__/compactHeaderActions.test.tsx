import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import compactHeaderActions from '../compactHeaderActions';
import { resolveActionKind } from '../headerActionIcons';
import { composeTitleSegments } from '../PageTitle';
import { Button, DropdownMenu, DropdownMenuTrigger } from '../ui';

/** Pictogramme d'écran : il relaie `strokeWidth` comme le font lucide et le shim `icons`. */
const RefreshGlyph = ({ strokeWidth }: { strokeWidth?: number | string }) => (
  <svg data-testid="glyph-ecran" strokeWidth={strokeWidth} />
);

describe('resolveActionKind', () => {
  it('reconnait le verbe, quelle que soit la suite du libelle', () => {
    expect(resolveActionKind('Rafraîchir')).toBe('refresh');
    expect(resolveActionKind('Actualiser les données')).toBe('refresh');
    expect(resolveActionKind('Exporter CSV')).toBe('export');
  });

  it('donne la priorite au PREMIER mot', () => {
    expect(resolveActionKind('Ajouter un filtre')).toBe('create');
    expect(resolveActionKind('Filtrer les demandes')).toBe('filter');
  });

  it('laisse indecis un libelle hors vocabulaire', () => {
    expect(resolveActionKind('Constellation')).toBeUndefined();
    expect(resolveActionKind('')).toBeUndefined();
  });
});

describe('composeTitleSegments', () => {
  it('accole les segments internes distincts du titre', () => {
    expect(composeTitleSegments('Configuration tarifaire', ['Abonnement PMS']))
      .toEqual(['Abonnement PMS']);
  });

  it('retire les segments vides et ceux qui repetent le titre', () => {
    expect(composeTitleSegments('Propriétés', ['  ', 'propriétés', 'Tarification']))
      .toEqual(['Tarification']);
  });
});

describe('compactHeaderActions', () => {
  it('remplace le libelle par une infobulle et le nom accessible', () => {
    render(
      <>
        {compactHeaderActions(
          <Button size="sm">
            <RefreshGlyph />
            Actualiser les données
          </Button>,
        )}
      </>,
    );

    const button = screen.getByRole('button', { name: 'Actualiser les données' });
    expect(button).toBeTruthy();
    expect(button.textContent).toBe('');
    expect(button.getAttribute('data-size')).toBe('icon');
  });

  it("depose le contour et la decoration de l'ecran", () => {
    render(
      <>
        {compactHeaderActions(
          <Button variant="outline" className="border-solid border-primary bg-transparent">
            <RefreshGlyph />
            Exporter
          </Button>,
        )}
      </>,
    );

    const button = screen.getByRole('button', { name: 'Exporter' });
    expect(button.getAttribute('data-variant')).toBe('ghost');
    expect(button.className).not.toContain('border-primary');
  });

  it('ramene le trait du pictogramme conserve a celui du chrome', () => {
    const { container } = render(
      <>{compactHeaderActions(<Button><RefreshGlyph />Constellation</Button>)}</>,
    );
    expect(container.querySelector('[data-testid="glyph-ecran"]')?.getAttribute('stroke-width'))
      .toBe('1.75');
  });

  it("substitue l'icone du vocabulaire commun a celle de l'ecran", () => {
    const { container } = render(
      <>{compactHeaderActions(<Button><RefreshGlyph />Exporter</Button>)}</>,
    );
    expect(container.querySelector('[data-testid="glyph-ecran"]')).toBeNull();
    expect(container.querySelector('button svg')).toBeTruthy();
  });

  it("garde l'icone de l'ecran quand le libelle ne designe rien de connu", () => {
    const { container } = render(
      <>{compactHeaderActions(<Button><RefreshGlyph />Constellation</Button>)}</>,
    );
    expect(container.querySelector('[data-testid="glyph-ecran"]')).toBeTruthy();
  });

  it('respecte data-keep-label', () => {
    render(<>{compactHeaderActions(<Button data-keep-label><RefreshGlyph />Rafraîchir</Button>)}</>);
    expect(screen.getByRole('button').textContent).toContain('Rafraîchir');
  });

  it('ne peut pas reduire un bouton sans icone', () => {
    render(<>{compactHeaderActions(<Button>Rafraîchir</Button>)}</>);
    expect(screen.getByRole('button').textContent).toBe('Rafraîchir');
  });

  it('traverse les fragments et les conteneurs', () => {
    render(
      <>
        {compactHeaderActions(
          <div className="flex">
            <Button><RefreshGlyph />Exporter</Button>
            <Button><RefreshGlyph />Ajouter</Button>
          </div>,
        )}
      </>,
    );
    expect(screen.getByRole('button', { name: 'Exporter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeTruthy();
  });

  it("n'enveloppe pas d'infobulle un bouton pose dans un asChild (la ref doit passer)", () => {
    render(
      <>
        {compactHeaderActions(
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><RefreshGlyph />Actions groupées</Button>
            </DropdownMenuTrigger>
          </DropdownMenu>,
        )}
      </>,
    );
    const button = screen.getByRole('button', { name: 'Actions groupées' });
    expect(button.getAttribute('title')).toBe('Actions groupées');
  });
});
