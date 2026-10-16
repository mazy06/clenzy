import type { UpsellTypeDto } from '../../services/api/upsellApi';

/** Canonical prestations first; keep a legacy selection editable without guessing its meaning. */
export function paidServiceTypeChoices(types: UpsellTypeDto[], current: string): UpsellTypeDto[] {
  const canonical = types.filter(type => type.platform && type.code === type.serviceItemCode);
  const codes = new Set(canonical.map(type => type.code));
  const ambiguous = new Set(['CLEANING', 'TRANSFER', 'EQUIPMENT', 'EXPERIENCE']);
  const other = types.filter(type => !codes.has(type.code) && (
    type.code === current || !ambiguous.has(type.code)
      && (!type.serviceItemCode || !codes.has(type.serviceItemCode))
  ));
  return [...canonical, ...other];
}
