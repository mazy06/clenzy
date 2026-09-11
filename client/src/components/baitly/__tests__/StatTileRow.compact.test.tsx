import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatTile from '../StatTile';
import StatTileRow from '../StatTileRow';

/**
 * Le mode compact est le bandeau des Rapports : une seule carte, les chiffres
 * sur une ligne de base. Ce qui est vérifié ici, c'est qu'il n'en coûte RIEN
 * aux appelants — mêmes props, même contenu lisible — et que ce qui ne tient
 * plus sur la ligne (le hint) ne disparaît pas pour autant.
 */
describe('StatTileRow — mode compact', () => {
  it('whenCompact_thenKeepsValueAndLabelReadable', () => {
    render(
      <StatTileRow compact>
        <StatTile icon={<svg />} label="Total utilisateurs" value={10} />
        <StatTile icon={<svg />} label="Administrateurs" value={0} />
      </StatTileRow>,
    );

    expect(screen.getByText('Total utilisateurs')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Administrateurs')).toBeInTheDocument();
  });

  it('whenCompact_thenTheHintSurvivesAsATooltip', () => {
    // Il n'a plus sa ligne, il garde son survol : l'information n'est pas perdue.
    render(
      <StatTileRow compact>
        <StatTile icon={<svg />} label="Occupation" value="76" unit="%" hint="sur 10 logements" />
      </StatTileRow>,
    );

    expect(screen.getByTitle('sur 10 logements')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('whenTileIsClickable_thenStaysARealButtonInCompactMode', () => {
    render(
      <StatTileRow compact>
        <StatTile icon={<svg />} label="Plateforme" value="321,15 €" onClick={() => {}} />
      </StatTileRow>,
    );

    expect(screen.getByRole('button', { name: /Plateforme/ })).toBeInTheDocument();
  });

  it('whenNotCompact_thenTheTilesKeepTheirOriginalShape', () => {
    const { container } = render(
      <StatTileRow>
        <StatTile icon={<svg />} label="Total" value={3} hint="contexte" />
      </StatTileRow>,
    );

    // Le pavé garde son hint EN CLAIR, pas en infobulle.
    expect(screen.getByText('contexte')).toBeInTheDocument();
    expect(container.querySelector('[title="contexte"]')).toBeNull();
  });

  it('whenTileCarriesADelta_thenTheVariationStaysVisibleInBothModes', () => {
    // La tendance du tableau de bord ne doit pas disparaître avec le pavé :
    // c'est un chiffre bref, teinté, rendu par le composant des Rapports.
    const { rerender } = render(
      <StatTileRow compact>
        <StatTile icon={<svg />} label="Occupation" value="76" unit="%" delta={3} deltaUnit="pts" />
      </StatTileRow>,
    );
    expect(screen.getByText(/\+3\s*pts/)).toBeInTheDocument();

    rerender(
      <StatTileRow>
        <StatTile icon={<svg />} label="Occupation" value="76" unit="%" delta={-2} />
      </StatTileRow>,
    );
    expect(screen.getByText(/-2\s*%/)).toBeInTheDocument();
  });
});
