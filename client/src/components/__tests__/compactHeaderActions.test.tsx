import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import compactHeaderActions from '../compactHeaderActions';
import { resolveActionKind } from '../headerActionIcons';
import { composeTitleSegments } from '../PageTitle';
import { Button, DropdownMenu, DropdownMenuTrigger } from '../ui';
import HeaderAction from '../HeaderAction';

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

  it('reconnait la creation dans les trois langues du PMS', () => {
    for (const label of ['Ajouter un logement', 'Create property', 'إضافة مسكن', 'إنشاء حجز جديد']) {
      expect(resolveActionKind(label)).toBe('create');
    }
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
  it('keeps a header creation attached to its form after removing its visible label', () => {
    let submissions=0;
    render(<><form id="header-create-form" onSubmit={event=>{event.preventDefault();submissions++;}}/><HeaderAction kind="create" label="Créer une campagne" type="submit" form="header-create-form"/></>);
    const button=screen.getByRole('button',{name:'Créer une campagne'});
    expect(button.textContent).toBe('');
    expect(button).toHaveAttribute('data-size','icon');
    expect(button).toHaveAttribute('data-header-action','create');
    fireEvent.click(button);expect(submissions).toBe(1);
  });

  it('keeps a text-only link destination and supplies an icon for an unknown action', () => {
    render(<>{compactHeaderActions(<Button asChild><a href="/devis">Mes devis</a></Button>)}</>);
    const link=screen.getByRole('link',{name:'Mes devis'});
    expect(link).toHaveAttribute('href','/devis');expect(link.textContent).toBe('');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('compacte aussi les creations sans perdre leur comportement', () => {
    let calls = 0;
    render(<>{compactHeaderActions(<div>
      <Button onClick={() => { calls++; }}><RefreshGlyph />Nouvelle réservation</Button>
      <Button disabled onClick={() => { calls++; }}><RefreshGlyph />Ajouter un logement</Button>
      <Button><RefreshGlyph />Exporter</Button>
    </div>)}</>);
    const create = screen.getByRole('button', { name: 'Nouvelle réservation' });
    expect(create.textContent).toBe('');
    fireEvent.click(create);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un logement' }));
    expect(calls).toBe(1);
    expect(screen.getByRole('button', { name: 'Exporter' }).textContent).toBe('');
  });

  it('conserve le lien et son libelle lors de la creation via asChild', () => {
    render(<>{compactHeaderActions(<Button asChild><a href="/properties/new"><RefreshGlyph />Créer un logement</a></Button>)}</>);
    const link = screen.getByRole('link', { name: 'Créer un logement' });
    expect(link.getAttribute('href')).toBe('/properties/new');
    expect(link.textContent).toBe('');
  });

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
    expect(button).toHaveAttribute('data-header-action','refresh');
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

  it('compacte les anciens boutons data-keep-label', () => {
    render(<>{compactHeaderActions(<Button data-keep-label><RefreshGlyph />Rafraîchir</Button>)}</>);
    expect(screen.getByRole('button').textContent).toBe('');
    expect(screen.getByRole('button')).toHaveAttribute('data-header-action','refresh');
  });

  it('preserves an explicit action role and active state independently of the translated label', () => {
    render(<>{compactHeaderActions(<Button data-header-action="pipeline" aria-pressed><RefreshGlyph/>Vue personnalisée</Button>)}</>);
    const button=screen.getByRole('button',{name:'Vue personnalisée'});
    expect(button).toHaveAttribute('data-header-action','pipeline');
    expect(button).toHaveAttribute('aria-pressed','true');
    expect(button).toHaveClass('baitly-header-action');
  });

  it('fournit une icone canonique aux boutons qui en etaient depourvus', () => {
    render(<>{compactHeaderActions(<Button>Rafraîchir</Button>)}</>);
    expect(screen.getByRole('button',{name:'Rafraîchir'}).textContent).toBe('');expect(screen.getByRole('button').querySelector('svg')).not.toBeNull();
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
