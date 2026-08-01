import { STATUS_TOKENS } from '../deviceRegistry';
import type { DeviceStatusLevel } from '../types';

interface StatusPillProps {
  level: DeviceStatusLevel;
  label: string;
  /** `pulse` anime le point pour les états vivants (en ligne). */
  pulse?: boolean;
}

/**
 * Pastille d'état normalisée : point coloré + libellé sur fond `-soft`.
 * Tokens sémantiques Signature : --ok en ligne, --warn attention, --err alerte,
 * neutre --muted/--hover hors ligne — suivent le thème clair/sombre.
 */
export default function StatusPill({ level, label, pulse = false }: StatusPillProps) {
  const { color, soft } = STATUS_TOKENS[level];
  return (
    <div className="inline-flex items-center gap-[3.75px] px-[5.25px] py-[1.5px] rounded-[var(--radius-pill)] max-w-full" style={{ backgroundColor: soft }}>
      {/* Le halo pulse passait par des @keyframes emises par MUI. Ici : un calque
          `animate-ping` derriere le point — meme lecture (onde qui s'evanouit),
          sans keyframes ad hoc, et desactive si l'utilisateur prefere moins
          d'animation. */}
      <span className="relative inline-flex w-[7px] h-[7px] shrink-0">
        {pulse && level === 'ok' && (
          <span
            className="absolute inset-0 rounded-[50%] opacity-60 animate-ping motion-reduce:animate-none"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="relative inline-flex w-[7px] h-[7px] rounded-[50%]" style={{ backgroundColor: color }} />
      </span>
      {/* couleur resolue a l'execution depuis STATUS_TOKENS : passe par style, pas par une classe */}
      <span className="cn-text-caption font-semibold leading-[1.2] truncate" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
