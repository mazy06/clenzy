import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../test/renderWithProviders';
import WorkOrderDetailLayout from '../WorkOrderDetailLayout';
import type { WorkOrderViewModel } from '../WorkOrderDetailLayout';

/**
 * Le coût d'un ordre de travail, et l'écart au barème conseil qui l'accompagne.
 *
 * <p>L'écart avait disparu de l'écran au passage des tuiles à la rangée de
 * faits : le prix restait affiché, mais plus rien ne disait s'il s'écartait du
 * barème — la seule chose que le chiffre seul ne dit pas. Rien ne l'avait vu,
 * puisque rien ne le regardait. Ces cas sont là pour ça.</p>
 */
function vm(overrides: Partial<WorkOrderViewModel> = {}): WorkOrderViewModel {
  return {
    type: 'CLEANING',
    status: 'PENDING',
    statusLabel: 'En attente',
    property: { name: 'Loft Bastille' },
    ...overrides,
  } as WorkOrderViewModel;
}

describe('WorkOrderDetailLayout — coût et écart au barème', () => {
  it('whenEstimatedCostDivergesFromScale_thenShowsTheGap', () => {
    renderWithProviders(<WorkOrderDetailLayout vm={vm({ estimatedCost: 90, recommendedCost: 75 })} />);

    // 90 vs 75 → +20 %, au-delà de la tolérance de 5 €.
    expect(screen.getByText(/\+20\s*%/)).toBeInTheDocument();
  });

  it('whenEstimatedCostSitsOnTheScale_thenSaysSoRatherThanShowingAGap', () => {
    renderWithProviders(<WorkOrderDetailLayout vm={vm({ estimatedCost: 77, recommendedCost: 75 })} />);

    // 2 € d'écart : dans la tolérance, donc « conforme » et non « +3 % ».
    expect(screen.getByText(/conforme au barème/i)).toBeInTheDocument();
  });

  it('whenActualCostIsKnown_thenTheScaleGapStepsAside', () => {
    // Le réel fait foi : un écart de DEVIS n'a plus rien à dire une fois le
    // travail facturé.
    renderWithProviders(
      <WorkOrderDetailLayout vm={vm({ estimatedCost: 90, recommendedCost: 75, actualCost: 95 })} />,
    );

    expect(screen.queryByText(/vs barème/i)).toBeNull();
    expect(screen.queryByText(/conforme au barème/i)).toBeNull();
  });

  it('whenThereIsNoScale_thenTheCostStandsAlone', () => {
    renderWithProviders(<WorkOrderDetailLayout vm={vm({ estimatedCost: 90 })} />);

    expect(screen.queryByText(/barème/i)).toBeNull();
  });
});
