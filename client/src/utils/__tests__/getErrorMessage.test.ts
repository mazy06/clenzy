import { describe, expect, it } from 'vitest';
import { getErrorMessage } from '../getErrorMessage';

describe('getErrorMessage', () => {
  it('lit le message d’une Error', () => {
    expect(getErrorMessage(new Error('Boom'))).toBe('Boom');
  });

  it('accepte une chaîne telle quelle', () => {
    expect(getErrorMessage('Boom')).toBe('Boom');
  });

  it('lit le message d’un ApiError, qui n’est pas une Error', () => {
    // `apiClient` lève un objet littéral `{status, message, details}`. Sans ce
    // cas, la raison renvoyée par le serveur n'atteignait jamais l'écran : le
    // paiement affichait « Erreur lors de la création de la session » au lieu
    // du motif réel du refus.
    const apiError = {
      status: 400,
      message: 'La demande de service doit etre en statut AWAITING_PAYMENT',
      details: {},
    };

    expect(getErrorMessage(apiError, 'repli')).toBe(
      'La demande de service doit etre en statut AWAITING_PAYMENT',
    );
  });

  it('retombe sur le repli quand le message est vide ou absent', () => {
    expect(getErrorMessage({ status: 500 }, 'repli')).toBe('repli');
    expect(getErrorMessage({ message: '   ' }, 'repli')).toBe('repli');
    expect(getErrorMessage(null, 'repli')).toBe('repli');
    expect(getErrorMessage(undefined, 'repli')).toBe('repli');
  });
});
