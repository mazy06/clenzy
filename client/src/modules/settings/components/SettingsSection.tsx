import React from 'react';
import { Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';

export type SettingsSectionAccent = 'primary' | 'accent' | 'info' | 'warm' | 'danger' | 'neutral';

const ACCENT_HEX: Record<SettingsSectionAccent, string> = {
  primary: 'var(--accent)',
  accent: 'var(--ok)',
  info: 'var(--info)',
  warm: 'var(--warn)',
  danger: 'var(--err)',
  neutral: 'var(--muted)',
};

interface SettingsSectionProps {
  title: string;
  /** Icone fallback (utilise si `avatar` non fourni ou que l'image ne charge pas). */
  icon: LucideIcon;
  accent?: SettingsSectionAccent;
  description?: string;
  /**
   * Explication longue, repliee derriere une icone a cote du titre.
   *
   * <p>A preferer a `description` des que le texte depasse une ligne : en clair,
   * il pousse le contenu utile vers le bas a chaque affichage, alors qu'on ne le
   * lit qu'une fois. Les deux props peuvent coexister — `description` pour le
   * rappel court, `help` pour le detail.</p>
   */
  help?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Alternative a l'icone : affiche une photo de profil en haut a gauche de la
   * section. Si `src` est absent ou que l'image echoue a charger, le fallback
   * prend le relais (`initials`, puis `icon` si les initiales sont vides).
   */
  avatar?: {
    src?: string;
    initials?: string;
    alt?: string;
  };
}

/**
 * Carte de section des Parametres (kit Baitly UI).
 *
 * Toutes les sections de tous les onglets passent par ici : c'est le seul
 * endroit ou se decide leur allure. La pastille d'accent reste teintee par
 * `color-mix` plutot que par une classe, parce que la teinte est une DONNEE
 * (`accent`) et non un etat — une table de classes Tailwind par accent serait
 * a re-synchroniser a chaque nouvelle couleur.
 */
const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  icon: Icon,
  accent = 'primary',
  description,
  help,
  action,
  children,
  avatar,
}) => {
  const color = ACCENT_HEX[accent];
  const badgeStyle = {
    backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
    color,
    borderColor: `color-mix(in srgb, ${color} 20%, transparent)`,
  };

  return (
    <Card
      className={cn(
        'h-full gap-0 overflow-hidden py-0 transition-colors duration-200',
        'hover:border-[color-mix(in_srgb,var(--section-accent)_40%,transparent)]',
      )}
      style={{ '--section-accent': color } as React.CSSProperties}
    >
      {/* `CardHeader` est une grille prevue pour titre / description / action.
          Ici une pastille precede le titre : on repasse en flex, sinon le media
          occupe sa propre rangee et l'en-tete se lit sur deux lignes. */}
      <CardHeader className="flex items-center gap-2.5 border-b px-3 py-2.5 [.border-b]:pb-2.5">
        {avatar ? (
          <Avatar className="size-8 shrink-0 rounded-lg border text-[0.75rem] font-semibold" style={badgeStyle}>
            <AvatarImage src={avatar.src} alt={avatar.alt ?? title} />
            <AvatarFallback className="rounded-lg bg-transparent text-inherit">
              {avatar.initials || <Icon size={16} strokeWidth={1.75} />}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border"
            style={badgeStyle}
          >
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1">
            <h3 className="m-0 truncate text-[0.9rem] font-semibold leading-[1.25] tracking-[-0.005em] text-foreground">
              {title}
            </h3>
            {help && (
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Element focusable : sans lui l'explication reste inaccessible
                      au clavier, le survol etant le seul declencheur. */}
                  <span
                    tabIndex={0}
                    role="note"
                    aria-label={help}
                    className={cn(
                      'inline-flex shrink-0 cursor-help items-center rounded-sm text-muted-foreground/70',
                      'transition-colors duration-150 hover:text-muted-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                    )}
                  >
                    <Info size={13} strokeWidth={2} />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-80">{help}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {description && (
            <p className="m-0 text-[0.72rem] leading-[1.35] text-muted-foreground">{description}</p>
          )}
        </div>

        {action && <CardAction className="self-center">{action}</CardAction>}
      </CardHeader>

      <CardContent className="flex-1 px-3 py-3">{children}</CardContent>
    </Card>
  );
};

export default SettingsSection;
