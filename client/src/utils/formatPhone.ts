/**
 * Formatage d'un numéro de téléphone pour l'affichage, sans dépendance externe.
 *
 * Gère les cas courants Clenzy : numéro WhatsApp brut ("33612345678@c.us"),
 * E.164 ("+33612345678"), national FR ("0612345678"). Pour les indicatifs non
 * gérés finement, on retombe sur un groupage générique par paires — lisible.
 */
export function formatPhoneNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  // Retire le suffixe WhatsApp (@c.us / @g.us) et tout sauf chiffres / '+'.
  const cleaned = raw.replace(/@.*$/, '').replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/^\+/, '');
  if (!digits) return raw;

  // France internationale : 33 + 9 chiffres → +33 X XX XX XX XX
  if (digits.startsWith('33') && digits.length === 11) {
    const n = digits.slice(2);
    return `+33 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  // France national : 0 + 9 chiffres → 0X XX XX XX XX
  if (digits.startsWith('0') && digits.length === 10) {
    return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  // International générique : groupes de 2, préfixe '+' si présent ou long.
  const grouped = digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return cleaned.startsWith('+') || digits.length > 10 ? `+${grouped}` : grouped;
}
