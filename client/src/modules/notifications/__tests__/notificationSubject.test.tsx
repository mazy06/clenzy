import { describe, it, expect } from 'vitest';
import { resolveSubject } from '../NotificationSubjectPanel';
import { resolveMetadataFacts } from '../notificationMeta';
import type { Notification } from '../../../services/api';

/** Notification minimale : seules les metadonnees decident du panneau. */
function notif(metadata: Record<string, unknown>): Notification {
  return {
    id: 1,
    title: 'peu importe',
    message: 'peu importe',
    type: 'info',
    category: 'system',
    read: false,
    createdAt: '2026-09-10T10:00:00Z',
    metadata,
  } as Notification;
}

function subjectOf(metadata: Record<string, unknown>) {
  const facts = resolveMetadataFacts(metadata).filter((fact) => fact.key !== 'property');
  return resolveSubject(facts, notif(metadata));
}

describe('resolveSubject — quel panneau pour quel sujet', () => {
  it('whenTheFactsDescribeAStay_thenTheStayPanelTakesThem', () => {
    const subject = subjectOf({
      guest: 'Ada Lovelace',
      reservationReference: 'ABNB-4821',
      checkIn: '2026-09-12',
      checkOut: '2026-09-15',
      amount: 640,
      currency: 'EUR',
      channel: 'AIRBNB',
    });

    expect(subject?.kind).toBe('stay');
    expect(subject?.consumed).toEqual(
      expect.arrayContaining(['guest', 'stay', 'reservationReference', 'channel', 'amount']),
    );
  });

  it('whenAMissionIsPaid_thenItIsFirstAMissionAndTheAmountStaysInTheList', () => {
    // La specificite l'emporte sur la richesse : une intervention chiffree reste
    // une intervention. Et le montant n'est PAS consomme — selon l'emetteur il
    // vaut un cout estime ou une somme reglee, le panneau ne saurait pas le nommer.
    const subject = subjectOf({
      intervention: 'Ménage complet',
      assignee: 'Sofia Marchetti',
      dueDate: '2026-09-16',
      amount: 85,
      currency: 'EUR',
    });

    expect(subject?.kind).toBe('task');
    expect(subject?.consumed).toContain('assignee');
    expect(subject?.consumed).toContain('dueDate');
    expect(subject?.consumed).not.toContain('amount');
  });

  it('whenNoiseCrossesItsThreshold_thenTheGaugePlacesItInsteadOfTheSentence', () => {
    const subject = subjectOf({ noiseDb: 78, noiseThresholdDb: 55 });

    expect(subject?.kind).toBe('noise');
    expect(subject?.consumed).toEqual(['noiseDb', 'noiseThresholdDb']);
  });

  it('whenOnlyOneOfTheTwoNoiseValues_thenNoGaugeIsDrawn', () => {
    // Une mesure sans seuil n'est pas un depassement, et un seuil seul n'est
    // pas un evenement : le releve les dit, la jauge se tait.
    expect(subjectOf({ noiseDb: 78 })).toBeNull();
    expect(subjectOf({ noiseThresholdDb: 55 })).toBeNull();
  });

  it('whenTheAmountIsAlone_thenItBecomesTheSubject', () => {
    const subject = subjectOf({ amount: 1240.5, currency: 'EUR' });

    expect(subject?.kind).toBe('money');
    expect(subject?.consumed).toEqual(['amount']);
  });

  it('whenAGuestHasNoStayNorReference_thenNoPanelPretendsThereIsOne', () => {
    expect(subjectOf({ guest: 'Ada Lovelace' })).toBeNull();
  });

  it('whenNothingHasAShape_thenTheListAloneDoesTheJob', () => {
    expect(subjectOf({ error: 'Adresse invalide', template: 'Bienvenue' })).toBeNull();
    expect(subjectOf({})).toBeNull();
  });
});
