import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';
import { usePlanningPricing } from '../hooks/usePlanningPricing';
import { useSettledRange } from '../hooks/useSettledRange';
import { addDays, toDateStr, getOverlappingChunks } from '../utils/dateUtils';
import { DATA_CHUNK_SIZE_DAYS } from '../constants';
import { calendarPricingApi } from '../../../services/api/calendarPricingApi';

/**
 * Charge RESEAU du planning.
 *
 * <p>Le quota de l'API est de 300 requetes par minute et par utilisateur
 * ({@code RateLimitConfig}). Peindre une grille de N logements en coutait
 * autrefois N × tranches — soit ~70 rien que pour les prix en vue Mois — et
 * chaque glissement de la fenetre relancait le tout. Un defilement rapide
 * epuisait le quota en quelques secondes et l'API repondait 429.</p>
 *
 * <p>Ces tests comptent les appels reellement emis. Ce sont des ASSERTIONS de
 * budget : si un refactor reintroduit une requete par logement, ils tombent.</p>
 */

vi.mock('../../../services/api/calendarPricingApi', () => ({
  calendarPricingApi: {
    getPricingBatch: vi.fn(async () => []),
  },
}));

const batchMock = vi.mocked(calendarPricingApi.getPricingBatch);

/** 10 logements : la taille d'une page de planning telle qu'affichee. */
const PROPERTY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const START = new Date(2026, 8, 6);
/** Fenetre de la vue Mois : 2 × 31 × 2 + 1 jours. */
const WINDOW_DAYS = 124;
/**
 * Nombre de tranches couvrant cette fenetre — DERIVE, jamais code en dur : le
 * test doit exprimer « une requete par tranche », pas memoriser combien il y en
 * a le jour ou il a ete ecrit.
 */
const CHUNKS = getOverlappingChunks(START, addDays(START, WINDOW_DAYS), DATA_CHUNK_SIZE_DAYS).length;

/**
 * UN seul client par test. En creer un a chaque rendu du wrapper (piege facile)
 * remonterait tous les observateurs a chaque rerender : les compteurs ne
 * mesureraient plus la strategie de chargement, mais le harnais lui-meme.
 */
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 5 * 60 * 1000 } },
  });
  return ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

/** Le montage reel : la fenetre de chargement derive de celle du rendu. */
function usePricingForWindow(bufferStart: Date) {
  const range = useSettledRange(bufferStart, addDays(bufferStart, WINDOW_DAYS));
  return usePlanningPricing(PROPERTY_IDS, range.start, range.end, true);
}

describe('planning — charge reseau', () => {
  beforeEach(() => {
    batchMock.mockClear();
    batchMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('une fenetre de vue Mois tient en une poignee de requetes, quel que soit le nombre de logements', async () => {
    const { result } = renderHook(() => usePricingForWindow(START), { wrapper: makeWrapper() });

    await waitFor(() => expect(batchMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Une requete par TRANCHE, pas par logement × tranche : c'est tout l'enjeu.
    // L'ancienne strategie en aurait emis 10 × CHUNKS pour la meme grille.
    expect(batchMock.mock.calls.length).toBe(CHUNKS);

    // Et chaque appel porte bien TOUS les logements.
    for (const [ids] of batchMock.mock.calls) {
      expect(ids).toEqual(PROPERTY_IDS);
    }
  });

  it('40 glissements en rafale ne chargent que la fenetre finale', async () => {
    // Horloge REELLE. Sous horloge simulee, React Query n'emettait aucune
    // requete du tout et l'assertion passait a vide — elle aurait tenu meme
    // sans palier. Ici la rafale dure quelques millisecondes, donc moins que le
    // palier de 250 ms : c'est bien lui qu'on mesure.
    const { rerender } = renderHook(
      ({ start }: { start: Date }) => usePricingForWindow(start),
      { wrapper: makeWrapper(), initialProps: { start: START } },
    );

    await waitFor(() => expect(batchMock).toHaveBeenCalled());
    await waitFor(() => expect(batchMock.mock.calls.length).toBe(CHUNKS));
    const afterFirstPaint = batchMock.mock.calls.length;

    // Defilement violent : la fenetre de RENDU glisse 40 fois d'affilee, chaque
    // etape a plus d'un mois de la precedente — donc AUCUNE tranche commune,
    // aucune ne pourrait etre servie par le cache.
    // Un commit PAR glissement : 40 rerenders dans un seul `act` seraient
    // batches par React et les fenetres intermediaires ne seraient jamais
    // rendues — la rafale n'existerait que sur le papier.
    for (let i = 1; i <= 40; i++) {
      await act(async () => {
        rerender({ start: addDays(START, i * 31) });
      });
    }

    // La fenetre se pose, puis ses tranches sont chargees.
    await waitFor(
      () => expect(batchMock.mock.calls.length).toBeGreaterThan(afterFirstPaint),
      { timeout: 2000 },
    );
    await new Promise((r) => setTimeout(r, 300));

    const slideCalls = batchMock.mock.calls.length - afterFirstPaint;
    // Seule la fenetre FINALE est chargee. Mesure faite en branchant le hook
    // directement sur la fenetre de rendu (sans palier) : 41 requetes pour la
    // meme rafale, toutes jetees sauf les dernieres. Et ce n'est que le prix —
    // les min-nights et les quatre requetes de donnees suivent la meme fenetre.
    expect(slideCalls).toBeLessThanOrEqual(CHUNKS + 1);

    // Et c'est bien la DERNIERE fenetre qui a ete chargee, pas une etape
    // intermediaire : sinon la grille afficherait des prix d'un autre mois.
    const lastFrom = batchMock.mock.calls[batchMock.mock.calls.length - 1][1];
    expect(lastFrom >= toDateStr(addDays(START, 40 * 31))).toBe(true);
  });

  it('revenir sur une fenetre deja vue ne recharge rien', async () => {
    const { rerender } = renderHook(
      ({ start }: { start: Date }) => usePricingForWindow(start),
      { wrapper: makeWrapper(), initialProps: { start: START } },
    );

    await waitFor(() => expect(batchMock).toHaveBeenCalled());
    const initial = batchMock.mock.calls.length;

    // Aller sur une fenetre GARANTIE disjointe — le decalage se derive de la
    // largeur de fenetre, pas d'un nombre de jours ecrit en dur : 62 jours
    // changeaient de tranche a 30 j, plus a 60.
    rerender({ start: addDays(START, WINDOW_DAYS + DATA_CHUNK_SIZE_DAYS) });
    await new Promise((r) => setTimeout(r, 350));
    const afterMove = batchMock.mock.calls.length;
    expect(afterMove).toBeGreaterThan(initial);

    rerender({ start: START });
    await new Promise((r) => setTimeout(r, 350));

    // Le cache React Query (staleTime 60 s) sert le retour : la cle est le LOT
    // de logements + la tranche, elle est donc identique a l'aller.
    expect(batchMock.mock.calls.length).toBe(afterMove);
  });

  it('le toggle « prix » coupe reellement le trafic', async () => {
    const { rerender } = renderHook(
      ({ on }: { on: boolean }) => {
        const range = useSettledRange(START, addDays(START, WINDOW_DAYS));
        return usePlanningPricing(PROPERTY_IDS, range.start, range.end, on);
      },
      { wrapper: makeWrapper(), initialProps: { on: false } },
    );

    await new Promise((r) => setTimeout(r, 100));
    expect(batchMock).not.toHaveBeenCalled();

    rerender({ on: true });
    await waitFor(() => expect(batchMock).toHaveBeenCalled());
  });
});
