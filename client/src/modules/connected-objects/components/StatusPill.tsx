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
 * Tokens sémantiques Baitly UI : succès en ligne, avertissement attention,
 * destructif alerte, neutre hors ligne — suivent le thème clair/sombre.
 *
 * <p>Le point prend la teinte VIVE (`dot`), le libellé l'encre `-ink` : un aplat
 * de 7 px n'est pas soumis au 4,5:1, du texte si.</p>
 */
export default function StatusPill({ level, label, pulse = false }: StatusPillProps) {
  const { color, soft, dot } = STATUS_TOKENS[level];
  return (
    <div className="inline-flex items-center gap-[3.75px] px-[5.25px] py-[1.5px] rounded-full max-w-full" style={{ backgroundColor: soft }}>
      {/* Le halo pulse passait par des @keyframes emises par MUI. Ici : un calque
          `animate-ping` derriere le point — meme lecture (onde qui s'evanouit),
          sans keyframes ad hoc, et desactive si l'utilisateur prefere moins
          d'animation. */}
      <span className="relative inline-flex w-[7px] h-[7px] shrink-0">
        {pulse && level === 'ok' && (
          <span
            className="absolute inset-0 rounded-full opacity-60 animate-ping motion-reduce:animate-none"
            style={{ backgroundColor: dot }}
          />
        )}
        <span className="relative inline-flex w-[7px] h-[7px] rounded-full" style={{ backgroundColor: dot }} />
      </span>
      {/* couleur resolue a l'execution depuis STATUS_TOKENS : passe par style, pas par une classe */}
      <span className="text-xs font-semibold leading-[1.2] truncate" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
