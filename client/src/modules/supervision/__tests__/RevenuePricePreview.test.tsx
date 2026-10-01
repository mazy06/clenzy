// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderWithProviders as render, screen } from '../../../test/renderWithProviders';
import { RevenuePricePreview } from '../components/RevenuePricePreview';
import { parseRevenuePricePlan } from '../core/revenuePricePreview';

const segments = [
  { from: '2026-10-05', to: '2026-10-07', percent: 15 },
  { from: '2026-10-12', to: '2026-10-14', percent: 15 },
  { from: '2026-10-24', to: '2026-10-26', percent: 12 },
  { from: '2026-11-09', to: '2026-11-26', percent: 12 },
  { from: '2026-11-29', to: '2026-12-20', percent: 7 },
  { from: '2026-12-20', to: '2026-12-30', percent: 7 },
];
const params = JSON.stringify({ direction: 'down', segments });
const motif = 'Occupation de 40 % sur les 90 prochains jours (seuil 55 %). 6 créneaux creux à optimiser : 5 oct.→6 oct. −15 % · 12 oct.→13 oct. −15 % · 24 oct.→25 oct. −12 % · 9 nov.→25 nov. −12 % · 29 nov.→19 déc. −7 % · 20 déc.→29 déc. −7 %.';

describe('RevenuePricePreview', () => {
  it('remplace la liste dense par six périodes et leur baisse, avec le contexte d’occupation', () => {
    const { container } = render(<RevenuePricePreview actionParams={params} motif={motif} />);
    expect(screen.queryByText(motif)).toBeNull();
    expect(screen.getByRole('meter', { name: 'Occupation' })).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(/Seuil 55/)).toBeVisible();
    expect(screen.getByText('54 nuits')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getAllByText(/−15\s*%/)).toHaveLength(2);
    // The rate applies to October 5 and 6, never to the exclusive October 7 endpoint.
    expect(container.querySelector('time[datetime="2026-10-06"]')).toBeTruthy();
    expect(container.querySelector('time[datetime="2026-10-07"]')).toBeNull();
  });

  it('conserve le sens hausse et le contexte métier non reconnu', () => {
    render(<RevenuePricePreview actionParams={JSON.stringify({direction:'up',segments:[{...segments[0],percent:8.5}]})} motif="Le prix moyen est inférieur à celui du marché." />);
    expect(screen.getByText(/\+8,5\s*%/)).toBeVisible();
    expect(screen.getByText('Le prix moyen est inférieur à celui du marché.')).toBeVisible();
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('affiche une seule date pour une nuit et l’année quand la période traverse le nouvel an', () => {
    const { container } = render(<RevenuePricePreview actionParams={JSON.stringify({segments:[
      {from:'2026-12-31',to:'2027-01-01',percent:5},
      {from:'2027-01-01',to:'2027-01-03',percent:10},
    ]})} motif="Ajustement proposé" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0].querySelectorAll('time')).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('2026');
    expect(rows[1]).toHaveTextContent('2027');
    expect(container.querySelector('time[datetime="2027-01-02"]')).toBeTruthy();
    expect(screen.getByText('1 nuit')).toBeVisible();
  });

  it('préserve l’explication de forte demande pour une hausse structurée', () => {
    render(<RevenuePricePreview actionParams={JSON.stringify({direction:'up',segments:[segments[0]]})}
      motif="Occupation de 90 % sur les 90 prochains jours : demande forte, prix possiblement sous-évalués. 1 créneau encore libre à revaloriser : 5 oct.→6 oct. +15 %." />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '90');
    expect(screen.getByText(/Forte demande : les tarifs/)).toBeVisible();
    expect(screen.getByText(/\+15\s*%/)).toBeVisible();
  });

  it.each([
    'invalid JSON',
    JSON.stringify({segments:[{from:'2026-02-30',to:'2026-03-03',percent:10}]}),
    JSON.stringify({segments:[{from:'2026-10-05',to:'2026-10-07'}]}),
    JSON.stringify({segments:[segments[0],{from:'2026-10-06',to:'2026-10-08',percent:12}]}),
  ])('garde le texte d’origine si les données sont incomplètes ou incohérentes (%s)', (invalid) => {
    render(<RevenuePricePreview actionParams={invalid} motif={motif} />);
    expect(screen.getByText(motif)).toBeVisible();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('compte les nuits civiles sans variation liée au passage à l’heure d’été', () => {
    expect(parseRevenuePricePlan(JSON.stringify({from:'2026-03-28',to:'2026-03-31',percent:12})))
      .toMatchObject({direction:'down',nights:3});
  });
});
