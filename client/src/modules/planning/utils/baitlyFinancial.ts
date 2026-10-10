interface BaitlyServiceAmount {
  actualCost?: number | null;
  estimatedCost?: number | null;
}

/** Les surfaces Baitly lisent le montant enregistré, jamais un devis inventé. */
export function getBaitlyServiceCost(service: BaitlyServiceAmount): number {
  const amount = service.actualCost ?? service.estimatedCost ?? 0;
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

/** La fin opérationnelle et PROCESSING ne constituent pas une preuve de règlement. */
export function isBaitlyServicePaid(service: { paymentStatus?: string; status?: string }): boolean {
  return service.paymentStatus === 'PAID';
}
