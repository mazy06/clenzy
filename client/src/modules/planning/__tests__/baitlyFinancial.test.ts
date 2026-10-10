import { describe, expect, it } from 'vitest';
import { getBaitlyServiceCost, isBaitlyServicePaid } from '../utils/baitlyFinancial';

describe('montants des prestations Baitly', () => {
  it('utilise le coût réel enregistré au lieu du tarif horaire historique', () => {
    expect(getBaitlyServiceCost({ actualCost: 70, estimatedCost: 60 })).toBe(70);
  });

  it('préserve un coût réel nul, notamment après une remise', () => {
    expect(getBaitlyServiceCost({ actualCost: 0, estimatedCost: 60 })).toBe(0);
  });

  it('utilise le devis en absence de coût réel, sans inventer un montant', () => {
    expect(getBaitlyServiceCost({ estimatedCost: 60 })).toBe(60);
    expect(getBaitlyServiceCost({})).toBe(0);
  });

  it('ne confond pas une prestation terminée ou un paiement en cours avec un règlement', () => {
    expect(isBaitlyServicePaid({ paymentStatus: 'PROCESSING', status: 'completed' })).toBe(false);
    expect(isBaitlyServicePaid({ status: 'completed' })).toBe(false);
    expect(isBaitlyServicePaid({ paymentStatus: 'PAID' })).toBe(true);
    expect(isBaitlyServicePaid({ paymentStatus: 'REFUNDED' })).toBe(false);
  });
});
