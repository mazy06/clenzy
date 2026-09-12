import { describe, it, expect } from 'vitest';
import { accessCodeVisitIdOf, nextVisitOf } from '../NotificationAccessCodePanel';
import type { AccessCodeVisit } from '../NotificationAccessCodePanel';
import type { Notification } from '../../../services/api';

/** Mission minimale : seuls le type, le statut et la date decident du choix. */
function visit(id: number, type: string, scheduledDate: string, status = 'PENDING'): AccessCodeVisit {
  return { id, type, scheduledDate, status };
}

/** Notification minimale : seuls la cle et les faits portent le lien dur. */
function notif(notificationKey: string, metadata: Record<string, unknown> = {}): Notification {
  return {
    id: 1,
    title: 'peu importe',
    message: 'peu importe',
    type: 'info',
    category: 'PROPERTY',
    read: false,
    createdAt: '2026-09-12T09:15:00Z',
    notificationKey,
    metadata,
  } as Notification;
}

describe('accessCodeVisitIdOf — la mission que l’emetteur a nommee', () => {
  it('whenTheRotationNamesAMission_thenItIsReadFromTheFacts', () => {
    expect(accessCodeVisitIdOf(notif('ACCESS_CODE_ROTATED', { interventionId: 412 }))).toBe(412);
  });

  it('whenTheNotificationPredatesTheFact_thenNothingIsPinned', () => {
    // Les fiches emises avant ce fait ne le porteront jamais : c'est la
    // deduction qui prend le relais, pas une erreur.
    expect(accessCodeVisitIdOf(notif('ACCESS_CODE_ROTATED'))).toBeNull();
  });

  it('whenAnotherKeyCarriesAnInterventionId_thenItIsNotClaimedHere', () => {
    expect(accessCodeVisitIdOf(notif('INTERVENTION_STARTED', { interventionId: 412 }))).toBeNull();
  });
});

describe('nextVisitOf — a qui le nouveau code est destine, a defaut de lien dur', () => {
  it('whenAListIsEmpty_thenNoOneIsExpected', () => {
    expect(nextVisitOf([])).toBeNull();
  });

  it('whenACleaningFollowsARepair_thenTheCleaningIsChosen', () => {
    // Le code tourne au depart du voyageur POUR le menage, meme quand une
    // autre mission est prevue plus tot sur le logement.
    const chosen = nextVisitOf([
      visit(1, 'PLUMBING_REPAIR', '2026-09-12T09:00:00'),
      visit(2, 'DEEP_CLEANING', '2026-09-12T14:00:00'),
    ]);
    expect(chosen?.id).toBe(2);
  });

  it('whenTwoCleaningsAreScheduled_thenTheEarliestIsChosen', () => {
    const chosen = nextVisitOf([
      visit(1, 'CLEANING', '2026-09-14T11:00:00'),
      visit(2, 'CLEANING', '2026-09-12T11:00:00'),
    ]);
    expect(chosen?.id).toBe(2);
  });

  it('whenTheCleaningIsCancelled_thenTheRemainingVisitIsChosen', () => {
    // Personne ne viendra pour une mission annulee : elle ne peut pas etre
    // l'intervenant a qui transmettre le code.
    const chosen = nextVisitOf([
      visit(1, 'CLEANING', '2026-09-12T11:00:00', 'CANCELLED'),
      visit(2, 'INSPECTION', '2026-09-13T09:00:00'),
    ]);
    expect(chosen?.id).toBe(2);
  });

  it('whenNoCleaningIsPlanned_thenTheFirstVisitStandsIn', () => {
    const chosen = nextVisitOf([
      visit(1, 'GARDENING', '2026-09-15T08:00:00'),
      visit(2, 'INSPECTION', '2026-09-13T08:00:00'),
    ]);
    expect(chosen?.id).toBe(2);
  });
});
