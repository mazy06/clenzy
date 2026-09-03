import React from 'react';
import { Alert, AlertDescription, Button } from '../../components/ui';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';

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
 */
const MissingContractsBanner: React.FC<MissingContractsBannerProps> = ({
  count,
  onEstablish,
  className,
}) => {
  const { t } = useTranslation();

  return (
    // Le variant `warning` du primitif porte déjà le fond pastel et l'encre
    // `-ink` : aucune couleur n'est réécrite ici, seule la mise en ligne.
    <Alert variant="warning" className={cn('flex shrink-0 items-center gap-2', className)}>
      <AlertDescription className="min-w-0 flex-1 text-xs">
        {`${count} ${t('contracts.gate.banner', "logement(s) sans contrat de gestion actif. La répartition par défaut de l'organisation s'applique en attendant.")}`}
      </AlertDescription>
      {/* CTA d'un bandeau d'avertissement : la teinte est portée par le bouton
          lui-même, encre `-ink` pour le libellé. Contourné et non fantôme — sur
          un fond pastel, un bouton sans contour se lit comme du texte et cesse
          d'annoncer qu'on peut agir. */}
      <Button
        variant="outline"
        size="sm"
        onClick={onEstablish}
        className="shrink-0 border-warning bg-transparent text-warning-ink hover:bg-warning-soft hover:text-warning-ink"
      >
        {t('contracts.gate.cta', 'Établir les contrats')}
      </Button>
    </Alert>
  );
};

export default MissingContractsBanner;
