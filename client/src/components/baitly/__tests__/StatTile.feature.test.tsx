import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatTile from '../StatTile';
import StatTileRow from '../StatTileRow';

/**
 * La tuile PORTANTE est l'unique moment engagé d'un écran. Ce qui est vérifié
 * ici n'est pas une couleur — c'est le contrat de contraste : la teinte porte
 * le fond, le filet et l'icône, JAMAIS le texte. `--accent` en texte plafonne
 * sous l'AA sur son propre fond pastel pour 7 des 8 teintes sélectionnables.
 */
describe('StatTile — tuile portante', () => {
  const tile = (feature: boolean) => (
    <StatTileRow compact>
      <StatTile feature={feature} icon={<svg data-testid="ico" />} label="Revenu du mois" value="12 400" />
    </StatTileRow>
  );

  it('whenFeature_thenTheGroundCarriesTheAccent', () => {
    const { container } = render(tile(true));
    expect(container.querySelector('.bg-\\[var\\(--accent-soft\\)\\]')).not.toBeNull();
  });

  it('whenNotFeature_thenNoAccentGround', () => {
    const { container } = render(tile(false));
    expect(container.querySelector('.bg-\\[var\\(--accent-soft\\)\\]')).toBeNull();
  });

  it('whenFeature_thenTheIconCarriesTheAccentButTheLabelDoesNot', () => {
    const { container } = render(tile(true));
    // L'icône prend --accent-deep : elle tient le seuil 3:1 des éléments non
    // textuels sur les huit teintes (3,20 au pire).
    expect(container.querySelector('.text-\\[var\\(--accent-deep\\)\\]')).not.toBeNull();
    // Le libellé prend l'encre PLEINE, pas la teinte ni l'encre secondaire :
    // celle-ci tombait à 4,49 sur un fond indigo posé sur la page.
    const label = screen.getByText('Revenu du mois');
    expect(label.className).toContain('text-foreground');
    expect(label.className).not.toContain('accent');
    expect(label.className).not.toContain('muted-foreground');
  });

  it('whenFeature_thenTheValueStaysInNormalInk', () => {
    render(tile(true));
    const value = screen.getByText('12 400');
    expect(value.className).not.toContain('accent');
  });
});
