import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { richText } from './richText';

/**
 * Le balisage des dictionnaires de maquettes.
 *
 * <p>Un seul cas compte vraiment : que rien d'autre que `<b>` ne soit
 * interprete. Le texte vient de nos propres fichiers, mais une phrase qui
 * contiendrait un chevron ne doit pas disparaitre de l'ecran.</p>
 */
describe('richText', () => {
  it('met en gras le seul passage balisé', () => {
    render(<p data-testid="p">{richText('Occupation à <b>72 %</b> en août.')}</p>);
    expect(screen.getByTestId('p').textContent).toBe('Occupation à 72 % en août.');
    expect(screen.getByText('72 %').tagName).toBe('B');
  });

  it('gère plusieurs passages', () => {
    render(<p data-testid="p">{richText('<b>14</b> arrivées et <b>11</b> départs')}</p>);
    expect(screen.getByTestId('p').textContent).toBe('14 arrivées et 11 départs');
  });

  it('n’interprète aucune autre balise', () => {
    render(<p data-testid="p">{richText('Prix < 100 & <i>net</i>')}</p>);
    expect(screen.getByTestId('p').textContent).toBe('Prix < 100 & <i>net</i>');
  });

  it('affiche la phrase entière quand la balise n’est pas fermée', () => {
    render(<p data-testid="p">{richText('Occupation <b>72 %')}</p>);
    expect(screen.getByTestId('p').textContent).toBe('Occupation <b>72 %');
  });
});
