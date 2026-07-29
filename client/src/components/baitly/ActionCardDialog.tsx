import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, ExternalLinkIcon, TriangleAlertIcon } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  Spinner,
} from '../ui';
import { Money } from '../Money';
import { actionItemsApi, refreshActionQueue } from '../../services/api/actionItemsApi';
import type { DashboardActionItem } from '../../services/api/dashboardOperationsApi';
import { ACTION_CARDS } from './actionCards';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Baitly — la carte de décision d'une action en attente.
 *
 * <p>Une file ne sert à rien si chaque ligne oblige à partir enquêter ailleurs.
 * Cette carte porte donc les trois choses qu'il faut pour <b>décider</b> :</p>
 *
 * <ol>
 *   <li><b>Ce qui s'est passé</b> — en une phrase, sans jargon.</li>
 *   <li><b>Ce que coûte l'inaction</b> — la partie qu'on omet d'ordinaire, et
 *       sans laquelle rien ne distingue l'urgent du reste.</li>
 *   <li><b>Le geste</b> — fait sur place quand c'est possible.</li>
 * </ol>
 *
 * <p>Le contenu de la boîte de dialogue <b>est</b> la carte : pas de
 * {@code Card} imbriqué. Une carte dans une carte ajoute un cadre, une ombre et
 * un rayon de plus sans rien apporter — c'est un anti-patron du systeme de
 * design du projet.</p>
 *
 * <p>Quand aucun geste n'est possible sur place — reconnecter un compte OAuth,
 * terminer une verification bancaire — la carte le dit et renvoie vers l'ecran
 * qui le porte, plutôt que d'afficher un bouton qui ne ferait rien.</p>
 */

export interface ActionCardDialogProps {
  /** Action a traiter. `null` ferme la carte. */
  item: DashboardActionItem | null;
  onClose: () => void;
  /** Cles react-query a invalider apres le geste. */
  invalidateKeys?: readonly (readonly unknown[])[];
}

export default function ActionCardDialog({
  item,
  onClose,
  invalidateKeys = [],
}: ActionCardDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const card = item ? ACTION_CARDS[item.kind] : undefined;

  const act = useMutation({
    mutationFn: (action: string) => actionItemsApi.act(item!.actionItemId!, action),
    onSuccess: () =>
      refreshActionQueue(
        (key) => queryClient.invalidateQueries({ queryKey: key }), invalidateKeys),
  });

  // Sans remise a zero, le resultat de la carte precedente s'afficherait sur la
  // suivante — un succes vert sur une action a laquelle on n'a pas touche.
  React.useEffect(() => act.reset(), [item?.actionItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return null;

  const gesture = card.gesture;
  // Une action deduite des donnees peut n'avoir aucune ligne persistee derriere
  // elle (fixtures de galerie) : le geste serait alors sans cible.
  const canAct = gesture != null && item?.actionItemId != null;

  return (
    <Dialog open={item != null} onOpenChange={(next) => !next && !act.isPending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={item?.severity === 'critical' ? 'destructive' : 'secondary'}>
              {severityLabel(item?.severity, t)}
            </Badge>
            {/* L'echeance passe avant tout le reste : passe le delai, la
                decision ne vaut plus rien. */}
            {item?.badge && <Badge variant="outline">{item.badge}</Badge>}
          </div>
          <DialogTitle className="pe-8">{item?.title}</DialogTitle>
          {item?.detail && <DialogDescription>{item.detail}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">{t(card.whatKey, card.what)}</p>
          {/* Ce que coute l'inaction — la phrase qui fait decider. */}
          <p className="font-medium text-foreground">
            {t(card.consequenceKey, card.consequence)}
          </p>
        </div>

        {(item?.propertyName || item?.amount != null || item?.subject) && (
          <ItemGroup>
            {item?.subject && (
              <Item size="sm" variant="muted">
                <ItemContent>
                  <ItemDescription>
                    {t('dashboard.actionCard.person', 'Personne concernée')}
                  </ItemDescription>
                  <ItemTitle>{item.subject}</ItemTitle>
                </ItemContent>
              </Item>
            )}
            {item?.propertyName && (
              <Item size="sm" variant="muted">
                <ItemContent>
                  <ItemDescription>
                    {t('dashboard.actionCard.property', 'Logement')}
                  </ItemDescription>
                  <ItemTitle>{item.propertyName}</ItemTitle>
                </ItemContent>
              </Item>
            )}
            {item?.amount != null && (
              <Item size="sm" variant="muted">
                <ItemContent>
                  <ItemDescription>
                    {t('dashboard.actionCard.amount', 'Montant en jeu')}
                  </ItemDescription>
                  <ItemTitle className="tabular-nums">
                    <Money value={item.amount} />
                  </ItemTitle>
                </ItemContent>
              </Item>
            )}
          </ItemGroup>
        )}

        {act.isSuccess && (
          <Alert>
            <CheckIcon />
            <AlertDescription>
              {gesture ? t(gesture.doneKey, gesture.done) : null}
            </AlertDescription>
          </Alert>
        )}

        {act.isError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>
              {t('dashboard.actionCard.failed', 'Le geste a échoué. L’action reste à traiter.')}
            </AlertDescription>
          </Alert>
        )}

        {/* Dire pourquoi il n'y a rien a cocher evite de chercher le bouton. */}
        {!gesture && (
          <p className="text-sm text-muted-foreground">
            {t(
              'dashboard.actionCard.elsewhere',
              'Ce geste ne se fait pas depuis ici — la ligne disparaîtra une fois la cause traitée.',
            )}
          </p>
        )}

        <DialogFooter className={card.route ? 'sm:justify-between' : undefined}>
          {card.route && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                navigate(card.route!);
              }}
            >
              <ExternalLinkIcon />
              {t(card.linkKey!, card.link!)}
            </Button>
          )}

          {gesture && (
            <Button
              variant={gesture.destructive ? 'destructive' : 'default'}
              onClick={() => act.mutate(gesture.action)}
              disabled={!canAct || act.isPending || act.isSuccess}
            >
              {act.isPending ? <Spinner /> : <CheckIcon />}
              {t(gesture.labelKey, gesture.label)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** L'urgence en un mot, la couleur ne suffisant pas a qui ne la distingue pas. */
function severityLabel(
  severity: string | undefined,
  t: (key: string, fallback: string) => string,
): string {
  if (severity === 'critical') return t('dashboard.actionCard.critical', 'Critique');
  if (severity === 'info') return t('dashboard.actionCard.info', 'Pour information');
  return t('dashboard.actionCard.warning', 'À surveiller');
}
