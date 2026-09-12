import { Spinner } from './ui';

/**
 * Attente d'un chunk de route (code-splitting via `React.lazy`).
 *
 * <p>Volontairement léger — il vit dans le bundle d'entrée. C'est le DERNIER
 * sursis tournant de l'application : le boot dessine la coquille
 * (`AppBootSkeleton`) et chaque page porte son propre squelette, si bien que
 * celui-ci n'apparaît que lorsque le préchargement du chunk n'a pas eu le
 * temps d'aboutir.</p>
 *
 * <p>Il s'étire dans la zone de contenu plutôt que de se centrer sur une
 * fraction arbitraire de la hauteur (`min-h-[60vh]`) : c'est ce qui le posait
 * plus haut que tout ce qui l'entourait.</p>
 */
export default function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className="flex w-full grow min-h-[50vh] items-center justify-center"
    >
      <Spinner className="size-8 text-primary" />
    </div>
  );
}
