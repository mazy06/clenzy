import { useState } from 'react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { Lock, Visibility, VisibilityOff, ContentCopy } from '../../../icons';
import { useNotification } from '../../../hooks/useNotification';
import { cn } from '../../../utils/cn';
import { usePropertyAccessCode } from '../usePropertyAccessCode';

/**
 * Digicode / boîte à clés d'un LOGEMENT, à hauteur du logement.
 *
 * <p>Ce code ne vit pas sur un objet : il est porté par les instructions
 * d'arrivée du logement, régénéré après chaque départ, et c'est lui que la
 * notification « Nouveau digicode / boîte à clés » demande de reporter à la
 * main sur la boîte. Le poser sur chaque carte serrure le répétait autant de
 * fois que le logement a d'entrées — trois fois pour une maison à porte,
 * portail et boîte à clés, pour une seule et même valeur.</p>
 *
 * <p>Il vit donc <b>à côté du nom du logement</b>, au-dessus de ses objets, là
 * où il n'existe qu'une fois. Les cartes gardent ce qui leur appartient en
 * propre : le code de séjour poussé sur CETTE serrure.</p>
 *
 * <p>En lecture seule : le code se modifie sur la fiche du logement, avec son
 * format et son renouvellement automatique.</p>
 */
export default function PropertyAccessCodeChip({ propertyId }: { propertyId: number }) {
  const { notify } = useNotification();
  const { data: instructions } = usePropertyAccessCode(propertyId);
  const [revealed, setRevealed] = useState(false);

  const code = instructions?.accessCode?.trim();
  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      notify.success('Digicode copié');
    } catch {
      notify.error('Copie impossible');
    }
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-[4.5px] text-muted-foreground">
            <Lock size={14} strokeWidth={1.75} />
            <span className="text-xs">Digicode</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {instructions?.accessCodeAutoRotate
            ? 'Digicode / boîte à clés du logement — renouvelé après chaque départ'
            : 'Digicode / boîte à clés du logement'}
        </TooltipContent>
      </Tooltip>

      <span
        className={cn(
          'text-xs tabular-nums font-semibold text-foreground bg-field rounded-md px-1.5 py-[1.5px] leading-[1.4]',
          revealed ? 'tracking-[0.06em]' : 'tracking-[0.18em]',
        )}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {revealed ? code : '••••••'}
      </span>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={revealed ? 'Masquer le digicode' : 'Afficher le digicode'}
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? <VisibilityOff size={14} strokeWidth={1.75} /> : <Visibility size={14} strokeWidth={1.75} />}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{revealed ? 'Masquer' : 'Afficher'}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button variant="ghost" size="icon-xs" aria-label="Copier le digicode" onClick={() => { void copy(); }}>
              <ContentCopy size={14} strokeWidth={1.75} />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Copier</TooltipContent>
      </Tooltip>
    </span>
  );
}
