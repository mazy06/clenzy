import type { LucideIcon } from 'lucide-react';
import type { AmenityTone } from '../amenityCategories';

export interface ToneTile {
  key: string;
  icon: LucideIcon;
  tone: AmenityTone;
  label: string;
  /** Précision sous le libellé (ex. le détail des vitres). */
  detail?: string;
}

/**
 * Grille icône + libellé : l'icône est posée sur une tuile pastel à la couleur
 * de sa famille. Utilisée pour les équipements et les prestations de ménage.
 */
export default function ToneTileList({ items }: { items: ToneTile[] }) {
  return (
    <ul className="pdo-tiles">
      {items.map(({ key, icon: Icon, tone, label, detail }) => (
        <li key={key}>
          {/* Couleur calculée : valeur CSS en ligne, jamais une classe Tailwind. */}
          <span className="pdo-tiles__icon" style={{ color: tone.ink, background: tone.soft }}>
            <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="pdo-tiles__text">
            <span dir="auto">{label}</span>
            {detail && <span className="pdo-tiles__detail">{detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
