import { describe, it, expect } from 'vitest';
import { businessActionsFor, KEYS_WITH_BUSINESS_ACTION } from '../notificationActions';
import type { Notification } from '../../../services/api';

function notification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    userId: 'kc-1',
    title: 'Titre',
    message: 'Message',
    type: 'warning',
    category: 'system',
    read: false,
    createdAt: '2026-09-09T10:00:00Z',
    ...overrides,
  } as Notification;
}

describe('businessActionsFor — gestes proposés par une notification', () => {
  it('whenLowStockCard_thenNamesTheOrderVerbAndOffersTheStockScreen', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'SUPERVISION_SUGGESTION',
      actionUrl: '/planning',
      metadata: { actionType: 'LINEN_STOCK_ORDER', propertyId: 42, module: 'ops' },
    }));

    expect(actions.map((entry) => entry.action.fallback)).toEqual([
      'Commander',
      'Voir le stock du logement',
    ]);
    // Le geste mene a la carte HITL elle-meme : bon logement, bon agent.
    expect(actions[0].href).toBe('/planning?property=42&agent=ops');
    expect(actions[1].href).toBe('/properties/42?tab=inventory&subtab=stock');
  });

  it('whenPropertyIsUnknown_thenFallsBackToThePlainQueue', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'SUPERVISION_SUGGESTION',
      actionUrl: '/planning',
      metadata: { actionType: 'CLEANING_REQUEST', module: 'ops' },
    }));

    expect(actions[0].href).toBe('/planning');
  });

  it('whenAgentIsUnknown_thenOpensTheRightPropertyAnyway', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'SUPERVISION_SUGGESTION',
      actionUrl: '/planning',
      metadata: { actionType: 'CLEANING_REQUEST', propertyId: 7 },
    }));

    expect(actions[0].href).toBe('/planning?property=7');
  });

  it('whenStockCardHasNoProperty_thenDropsTheStockLinkRatherThanLinkNowhere', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'SUPERVISION_SUGGESTION',
      actionUrl: '/planning',
      metadata: { actionType: 'LINEN_STOCK_ORDER' },
    }));

    expect(actions.map((entry) => entry.action.fallback)).toEqual(['Commander']);
  });

  it('whenSupervisionCardIsInformational_thenStillLeadsToItsAgent', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'SUPERVISION_SUGGESTION',
      actionUrl: '/planning',
      metadata: { module: 'ops', propertyId: 5 },
    }));

    expect(actions).toHaveLength(1);
    expect(actions[0].action.fallback).toBe('Ouvrir la file de supervision');
    expect(actions[0].href).toBe('/planning?property=5&agent=ops');
  });

  it('whenActionTargetsItsOwnDeepLink_thenUsesTheLinkChosenByTheEmitter', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'SERVICE_REQUEST_CREATED',
      actionUrl: '/interventions?tab=service-requests&highlight=7',
    }));

    expect(actions[0].action.fallback).toBe('Traiter la demande');
    expect(actions[0].href).toBe('/interventions?tab=service-requests&highlight=7');
  });

  it('whenAssignedInterventionIsKnown_thenLeadsToTheRunScreen', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'INTERVENTION_ASSIGNED_TO_USER',
      actionUrl: '/interventions/9',
      metadata: { interventionId: 9 },
    }));

    expect(actions[0].href).toBe('/interventions/9/suivi');
  });

  it('whenInterventionIdIsMissing_thenFallsBackToTheEmitterLink', () => {
    const actions = businessActionsFor(notification({
      notificationKey: 'INTERVENTION_ASSIGNED_TO_USER',
      actionUrl: '/interventions?tab=service-requests&highlight=3',
    }));

    expect(actions[0].href).toBe('/interventions?tab=service-requests&highlight=3');
  });

  it('whenActionHasNoDeepLinkAtAll_thenProposesNothing', () => {
    const actions = businessActionsFor(notification({ notificationKey: 'SERVICE_REQUEST_CREATED' }));

    expect(actions).toEqual([]);
  });

  it('whenKeyIsPurelyInformational_thenProposesNoBusinessAction', () => {
    expect(businessActionsFor(notification({
      notificationKey: 'USER_CREATED',
      actionUrl: '/users',
    }))).toEqual([]);
  });

  it('whenNotificationHasNoKey_thenProposesNoBusinessAction', () => {
    expect(businessActionsFor(notification({ actionUrl: '/dashboard' }))).toEqual([]);
  });

  it('thenTheCatalogueCoversTheOperationalKeys', () => {
    expect(KEYS_WITH_BUSINESS_ACTION).toContain('SUPERVISION_SUGGESTION');
    expect(KEYS_WITH_BUSINESS_ACTION).toContain('PAYMENT_FAILED');
    expect(KEYS_WITH_BUSINESS_ACTION).toContain('NOISE_ALERT_CRITICAL');
    expect(new Set(KEYS_WITH_BUSINESS_ACTION).size).toBe(KEYS_WITH_BUSINESS_ACTION.length);
  });
});
