import { describe, it, expect } from 'vitest';
import { FACT_ICON, deepLinkId, resolveDestination, resolveMetadataFacts } from '../notificationMeta';
import { SCREEN_ICON } from '../../../config/navigationIcons';

describe('resolveMetadataFacts — faits affichables d\'une notification', () => {
  it('whenStayHasBothBounds_thenRendersASingleStayFact', () => {
    const facts = resolveMetadataFacts({ checkIn: '2026-09-12', checkOut: '2026-09-15' });

    expect(facts).toEqual([{ key: 'stay', kind: 'stay', from: '2026-09-12', to: '2026-09-15' }]);
  });

  it('whenOnlyOneBound_thenKeepsItAsItsOwnFact', () => {
    const facts = resolveMetadataFacts({ checkIn: '2026-09-12' });

    expect(facts).toEqual([{ key: 'checkIn', kind: 'date', value: '2026-09-12' }]);
  });

  it('whenAmountIsPresent_thenCarriesTheCurrencyAlongside', () => {
    const facts = resolveMetadataFacts({ amount: 120.5, currency: 'EUR' });

    expect(facts).toEqual([{ key: 'amount', kind: 'money', value: 120.5, currency: 'EUR' }]);
  });

  it('whenAmountArrivesAsString_thenStillReadsAsANumber', () => {
    const facts = resolveMetadataFacts({ amount: '89.90', currency: 'MAD' });

    expect(facts).toEqual([{ key: 'amount', kind: 'money', value: 89.9, currency: 'MAD' }]);
  });

  it('whenKeyIsUnknownOrValueMalformed_thenIgnoresItSilently', () => {
    const facts = resolveMetadataFacts({
      property: 'Loft Bastille',
      secretToken: 'ne-doit-pas-sortir',
      amount: 'pas-un-nombre',
      guest: '   ',
      channel: null,
    });

    expect(facts).toEqual([{ key: 'property', kind: 'text', value: 'Loft Bastille' }]);
  });

  it('whenMetadataIsAbsent_thenReturnsNoFact', () => {
    expect(resolveMetadataFacts(null)).toEqual([]);
    expect(resolveMetadataFacts(undefined)).toEqual([]);
  });

  it('thenEveryFactTheServerCanSendReachesTheScreen', () => {
    // Regression : `assignee`, `dueDate`, `request`, `document` et `rating`
    // etaient declares cote serveur, pourvus d'une icone... et absents de la
    // table du client. Les services les envoyaient, l'ecran les jetait en
    // silence. Ce test lie les deux : une cle affichable produit un fait.
    const sample: Record<string, unknown> = {
      property: 'Loft Bastille',
      guest: 'Ada Lovelace',
      rating: 4,
      reservationReference: 'ABNB-4821',
      checkIn: '2026-09-12',
      amount: 120,
      currency: 'EUR',
      channel: 'AIRBNB',
      request: 'Fuite sous l\'évier',
      intervention: 'Ménage complet',
      assignee: 'Sofia Marchetti',
      dueDate: '2026-09-16',
      document: 'Facture 2026-041.pdf',
      template: 'Bienvenue',
      error: 'Adresse invalide',
    };

    const keys = resolveMetadataFacts(sample).map((fact) => fact.key);

    for (const key of Object.keys(sample)) {
      if (key === 'currency') continue; // porte par le fait `amount`
      expect(keys, `fait perdu : « ${key} »`).toContain(key);
    }
  });

  it('whenRatingIsSent_thenReadsAsANumberToBeDrawnAsStars', () => {
    expect(resolveMetadataFacts({ rating: 4 })).toEqual([{ key: 'rating', kind: 'rating', value: 4 }]);
  });

  it('whenSeveralFacts_thenKeepsTheReadingOrderOfTheTable', () => {
    const facts = resolveMetadataFacts({
      error: 'Adresse invalide',
      amount: 42,
      currency: 'EUR',
      property: 'Loft Bastille',
      guest: 'Ada Lovelace',
    });

    expect(facts.map((fact) => fact.key)).toEqual(['property', 'guest', 'amount', 'error']);
  });
});

describe('resolveDestination — écran visé par une notification', () => {
  it('whenRouteIsADetailPage_thenNamesTheTabItBelongsTo', () => {
    const destination = resolveDestination('/service-requests/42');

    expect(destination?.path).toBe('/service-requests/42');
    expect(destination?.fallbackLabel).toBe('Interventions');
  });

  it('whenRouteCarriesAQuery_thenIgnoresItToMatchTheScreen', () => {
    expect(resolveDestination('/reservations?highlight=7')?.fallbackLabel).toBe('Réservations');
    expect(resolveDestination('/settings?tab=ai')?.fallbackLabel).toBe('Paramètres');
  });

  it('whenRouteIsUnknown_thenStillOffersToOpenItWithoutAName', () => {
    const destination = resolveDestination('/un-ecran-inconnu/9');

    expect(destination).toEqual({ path: '/un-ecran-inconnu/9' });
  });

  it('whenThereIsNoActionUrl_thenThereIsNoDestination', () => {
    expect(resolveDestination(undefined)).toBeNull();
  });
});

describe('FACT_ICON — vocabulaire d\'icônes emprunté au PMS', () => {
  it('thenEveryDisplayableFactHasItsIcon', () => {
    const displayable = [
      'property', 'guest', 'reservationReference', 'stay', 'checkIn', 'checkOut',
      'amount', 'channel', 'template', 'intervention', 'request', 'document',
      'assignee', 'dueDate', 'rating', 'error',
    ];

    for (const key of displayable) {
      expect(FACT_ICON[key], `icône manquante pour « ${key} »`).toBeTruthy();
    }
  });

  it('whenTheFactHasItsOwnScreen_thenReusesTheApplicationIcon', () => {
    // Même glyphe que le fil d'Ariane et la barre latérale : un logement ne se
    // reconnaît pas à un dessin différent selon l'écran.
    expect(FACT_ICON.property).toBe(SCREEN_ICON['/properties']);
    expect(FACT_ICON.amount).toBe(SCREEN_ICON['/billing']);
    expect(FACT_ICON.intervention).toBe(SCREEN_ICON['/interventions']);
    expect(FACT_ICON.stay).toBe(SCREEN_ICON['/reservations']);
  });
});

describe('deepLinkId — repecher un identifiant dans le lien profond', () => {
  const notif = (actionUrl?: string): Notification =>
    ({ id: 1, title: '', message: '', type: 'info', category: 'system', read: false,
       createdAt: '2026-09-11T10:00:00Z', actionUrl } as Notification);

  it('whenTheLinkOpensARecord_thenThePathSegmentIsTheIdentifier', () => {
    expect(deepLinkId(notif('/interventions/97'), { pathPrefix: '/interventions' })).toBe(97);
    expect(deepLinkId(notif('/interventions/97/suivi'), { pathPrefix: '/interventions' })).toBe(97);
  });

  it('whenTheSegmentIsARoute_thenNothingIsInvented', () => {
    // « pending-payment » est un ecran, pas une intervention.
    expect(deepLinkId(notif('/interventions/pending-payment'), { pathPrefix: '/interventions' }))
      .toBeNull();
    expect(deepLinkId(notif('/interventions'), { pathPrefix: '/interventions' })).toBeNull();
  });

  it('whenTheLinkHighlightsARow_thenTheQueryParameterIsTheIdentifier', () => {
    expect(deepLinkId(notif('/interventions?tab=issues&highlight=42'), { param: 'highlight' }))
      .toBe(42);
  });

  it('whenThereIsNoLinkOrNoIdentifier_thenNull', () => {
    expect(deepLinkId(notif(), { param: 'highlight' })).toBeNull();
    expect(deepLinkId(notif('/planning'), { param: 'highlight' })).toBeNull();
    expect(deepLinkId(notif('/interventions?highlight=abc'), { param: 'highlight' })).toBeNull();
  });

  it('whenTheLinkPointsElsewhere_thenThePrefixIsNotBorrowed', () => {
    expect(deepLinkId(notif('/interventions-archive/97'), { pathPrefix: '/interventions' }))
      .toBeNull();
  });
});
