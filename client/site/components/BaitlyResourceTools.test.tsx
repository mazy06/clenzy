import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BaitlyAcademy,
  BaitlyJournal,
  MarketBarometer,
  ObligationsGuide,
  ResourceGlossary,
  RevenueCalculator,
} from './BaitlyResourceTools';
import {
  calculateRevenue,
  DEFAULT_REVENUE_INPUTS,
  normalizeResourceSearch,
} from '../data/baitlyResources';
import { BAITLY_RESOURCE_MESSAGES } from '../lib/messages/baitlyResources';
import { RESOURCE_GLOSSARY } from '../data/baitlyResourceGlossary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Outils publics Baitly', () => {
  it.each([
    ['SA', 2],
    ['FR', 1],
    ['unknown', 0],
  ] as const)(
    'opens the country selected in Solutions: %s',
    (country, index) => {
      render(<ObligationsGuide language="fr" initialCountry={country} />);
      expect(
        screen.getByRole('button', {
          name: BAITLY_RESOURCE_MESSAGES.fr.guide.countries[index],
          exact: true,
        }),
      ).toHaveAttribute('aria-pressed', 'true');
    },
  );
  it('calcule revenus, commissions et charges au même périmètre, y compris plusieurs logements', () => {
    const result = calculateRevenue({
      properties: 2,
      nights: 20,
      occupancy: 50,
      rate: 100,
      commission: 15,
      variableCost: 20,
      fixedCost: 300,
      extras: 5,
    });
    expect(result).toMatchObject({
      bookedNights: 10,
      accommodation: 2000,
      extras: 100,
      fees: 300,
      operatingCosts: 1000,
      net: 800,
    });
    expect(result.breakEven).toBeCloseTo((300 / (20 * 70)) * 100);
    expect(
      calculateRevenue({ ...DEFAULT_REVENUE_INPUTS, occupancy: 0 }).net,
    ).toBe(-2500);
    expect(
      calculateRevenue({ ...DEFAULT_REVENUE_INPUTS, rate: 0, extras: 0 })
        .breakEven,
    ).toBeNull();
    expect(
      Number.isFinite(
        calculateRevenue({ ...DEFAULT_REVENUE_INPUTS, occupancy: NaN }).net,
      ),
    ).toBe(true);
  });

  it('masque le résultat invalide, puis recalcule après correction', () => {
    const m = BAITLY_RESOURCE_MESSAGES.fr.calc;
    render(<RevenueCalculator language="fr" />);
    const count = screen.getByRole('spinbutton', {
      name: new RegExp(m.fields[0]),
    });
    fireEvent.change(count, { target: { value: '' } });
    expect(screen.getByRole('status')).toHaveTextContent(m.invalid);
    expect(screen.getByRole('button', { name: m.download })).toBeDisabled();
    fireEvent.change(count, { target: { value: '2' } });
    expect(screen.getByRole('button', { name: m.download })).toBeEnabled();
    expect(screen.getByLabelText(/18\s?887,5 Dirham marocain/)).toBeVisible();
    fireEvent.change(count, { target: { value: '1.5' } });
    expect(screen.getByRole('button', { name: m.download })).toBeDisabled();
    fireEvent.click(
      screen.getByRole('button', { name: BAITLY_RESOURCE_MESSAGES.fr.reset }),
    );
    expect(count).toHaveValue(1);
  });

  it('exporte un CSV avec les hypothèses et le solde calculé', async () => {
    let blob: Blob | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: (value: Blob) => {
        blob = value;
        return 'blob:scenario';
      },
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(<RevenueCalculator language="fr" />);
    fireEvent.click(
      screen.getByRole('button', {
        name: BAITLY_RESOURCE_MESSAGES.fr.calc.download,
      }),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(blob?.type).toBe('text/csv;charset=utf-8');
    const csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob!);
    });
    expect(csv).toContain('"Nombre de logements";"1"');
    expect(csv).toContain('"Solde avant impôts et financement";"9443.75"');
    vi.unstubAllGlobals();
  });

  it('change la destination du baromètre sans présenter la croissance comme une occupation', () => {
    render(
      <MemoryRouter>
        <MarketBarometer language="fr" />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'essaouira' },
    });
    expect(screen.getByText('Évolution des nuitées · Essaouira')).toBeVisible();
    expect(
      screen.getByText(/points par rapport au niveau national/),
    ).toHaveTextContent('-3');
    expect(
      screen.getByText(BAITLY_RESOURCE_MESSAGES.fr.market.unavailable),
    ).toBeVisible();
  });

  it('garde les coches séparées par pays et exporte les sources de la liste sélectionnée', async () => {
    let blob: Blob | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: (value: Blob) => {
        blob = value;
        return 'blob:checklist';
      },
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const m = BAITLY_RESOURCE_MESSAGES.fr;
    render(<ObligationsGuide language="fr" />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(
      screen.getByRole('button', { name: 'France', exact: true }),
    );
    expect(screen.queryAllByRole('checkbox', { checked: true })).toHaveLength(
      0,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Maroc', exact: true }));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: m.guide.download }));
    const txt = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob!);
    });
    expect(txt).toContain('[x] Qualifier votre hébergement');
    expect(txt).toContain('https://mtaess.gov.ma/');
    vi.unstubAllGlobals();
  });

  it.each(['fr', 'en', 'ar'] as const)(
    'valide une leçon uniquement sur la bonne réponse en %s',
    (language) => {
      const m = BAITLY_RESOURCE_MESSAGES[language].academy;
      render(<BaitlyAcademy language={language} />);
      expect(screen.getByRole('button', { name: m.check })).toBeDisabled();
      fireEvent.click(screen.getByRole('radio', { name: '85' }));
      fireEvent.click(screen.getByRole('button', { name: m.check }));
      expect(screen.getByRole('status')).toHaveTextContent(m.retry);
      expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
      fireEvent.click(screen.getByRole('radio', { name: '65' }));
      fireEvent.click(screen.getByRole('button', { name: m.check }));
      expect(screen.getByRole('status')).toHaveTextContent(m.success);
      expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
      fireEvent.click(screen.getByRole('button', { name: m.next }));
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        m.lessons[1].title,
      );
      expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();
      expect(screen.getByRole('button', { name: m.check })).toBeDisabled();
      expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1');
    },
  );

  it('filtre les articles et propose un véritable contenu de lecture', () => {
    const m = BAITLY_RESOURCE_MESSAGES.fr;
    render(<BaitlyJournal language="fr" />);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Opérations' }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    const details = screen
      .getByRole('heading', { level: 2 })
      .closest('details')!;
    fireEvent.click(details.querySelector('summary')!);
    expect(details).toHaveAttribute('open');
    expect(
      within(details).getByText(m.blog.articles[2].sections[0].copy),
    ).toBeVisible();
  });

  it('recherche sans accents et dans les trois langues, avec un état vide réinitialisable', () => {
    expect(normalizeResourceSearch('إِشْغَال')).toBe('اشغال');
    render(<ResourceGlossary language="fr" />);
    const search = screen.getByRole('searchbox');
    fireEvent.change(search, { target: { value: 'REVPAR' } });
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'وديعة' } });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Dépôt de garantie',
    );
    fireEvent.change(search, { target: { value: 'terme inexistant' } });
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(
      RESOURCE_GLOSSARY.length,
    );
    for (const entry of RESOURCE_GLOSSARY)
      for (const language of ['fr', 'en', 'ar'] as const) {
        expect(entry[language].definition.length).toBeGreaterThan(25);
      }
  });
});
