import React, { useCallback } from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { Close as CloseIcon } from '../../icons';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { useUserPreference } from '../../hooks/useUserPreference';

/** Cle de la preference qui retient le masquage, partagee par tous les ecrans. */
const DISMISS_KEY = 'contracts.missingGate.dismissedCount';

interface MissingContractsBannerProps {
  /** Nombre de logements sans contrat de gestion actif. */
  count: number;
  /** Ouvre la création de contrat, préselectionnée sur le premier à régulariser. */
  onEstablish: () => void;
  /** Espacement propre à l'écran hôte. */
  className?: string;
}

/**
 * Rappel des logements sans contrat de gestion actif.
 *
 * <p>Le même bandeau apparaît sur le tableau de bord et sur la liste des
 * logements. Il vivait en deux exemplaires, et les deux avaient dérivé : l'un
 * portait un triangle d'alerte et un bouton fantôme, l'autre ni icône ni
 * fantôme mais une pilule contournée. Même phrase, deux objets — le lecteur
 * doutait de lire la même chose.</p>
 *
 * <p>La donnée reste propre à chaque écran : la liste compte les logements
 * qu'elle affiche, le tableau de bord interroge l'organisation entière. Seule
 * la PRÉSENTATION est mutualisée, et c'est elle qui avait divergé.</p>
 *
 * <p>Pas d'icône : la teinte du variant `warning` dit déjà la nature du
 * message, et un pictogramme de plus devant une phrase qui tient sur une ligne
 * la repousse sans rien ajouter.</p>
 *
 * <h2>Masquage : une mise en veille, pas un renvoi définitif</h2>
 * <p>Le bandeau se masque, et le masquage suit l'utilisateur d'un écran et
 * d'un appareil à l'autre — c'est la même alerte, la taire deux fois serait
 * absurde. Mais ce qu'il annonce est un défaut de conformité : ce n'est pas
 * un message qu'on enterre. On retient donc le NOMBRE au moment du masquage,
 * et le bandeau revient dès qu'un logement de plus se retrouve sans contrat.
 * Régulariser fait baisser le compte et le laisse muet, ce qui est la bonne
 * direction.</p>
 */
const MissingContractsBanner: React.FC<MissingContractsBannerProps> = ({
  count,
  onEstablish,
  className,
}) => {
  const { t } = useTranslation();
  const [dismissedCount, setDismissedCount] = useUserPreference<number>(DISMISS_KEY, 0);

  const handleDismiss = useCallback(() => setDismissedCount(count), [count, setDismissedCount]);

  if (count <= dismissedCount) return null;

  return (
    <Alert variant="warning" className={cn('flex shrink-0 items-center gap-2', className)}>
      <AlertDescription className="min-w-0 flex-1 text-xs">
        {`${count} ${t('contracts.gate.banner', "logement(s) sans contrat de gestion actif. La répartition par défaut de l'organisation s'applique en attendant.")}`}
      </AlertDescription>
      <Button
        variant="outline"
        size="sm"
        onClick={onEstablish}
        className="shrink-0 border-warning bg-transparent text-warning-ink hover:bg-warning-soft hover:text-warning-ink"
      >
        {t('contracts.gate.cta', 'Établir les contrats')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleDismiss}
        aria-label={t('contracts.gate.dismiss', 'Masquer ce rappel')}
        className="shrink-0 text-warning-ink hover:bg-warning-soft hover:text-warning-ink"
      >
        <CloseIcon size={16} strokeWidth={1.75} />
      </Button>
    </Alert>
  );
};

export default MissingContractsBanner;
