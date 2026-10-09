/**
 * Mark « maison » Baitly — version légère pour le site marketing : sans MUI ni
 * animation, le trait suit `currentColor` (teintable par le parent). Le tracé,
 * le viewBox et l'épaisseur sont repris à l'identique de
 * `src/components/BaitlyMarkLogo` (aucun réinvention du dessin).
 */

// Tracé de la maison en un trait continu (viewBox 1024 d'origine).
const MARK_PATH =
  'M463 590.25 A30.25 30.25 0 0 1 463 529.75 A30.25 30.25 0 0 1 463 590.25 V710 ' +
  'A30 30 0 0 1 433 740 H368 A65 65 0 0 1 303 675 V441.8 A28 28 0 0 1 313.9 419.6 ' +
  'L478.2 294.1 A54 54 0 0 1 543.8 294.1 L708.1 419.6 A28 28 0 0 1 719 441.8 V675 ' +
  'A65 65 0 0 1 654 740 H589 A30 30 0 0 1 559 710 V590.25 A30.25 30.25 0 0 1 559 529.75 ' +
  'A30.25 30.25 0 0 1 559 590.25';

export default function BaitlyMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="251 251 522 522"
      fill="none"
      role="img"
      aria-label="Baitly"
      style={{ display: 'block', color: 'currentColor' }}
    >
      <path
        d={MARK_PATH}
        stroke="currentColor"
        strokeWidth={21}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
